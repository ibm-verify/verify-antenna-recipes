// CONFIGURATION: edit the placeholder values below before deployment.
// Subject mode is explicitly opaque in BOTH handlers; no renderer/environment file is required.
importClass(logger);
importClass(http);

logger.info("----- vault_agent_registry_action.js IBM VERIFY AGENT -> VAULT AGENT REGISTRY -----");


var wrapper = JSON.parse(eventStr);
var claims = wrapper.claimsJson ? wrapper.claimsJson : wrapper;

var vaultAddr = "https://<Vault-host>:8200";
var vaultToken = "<Vault-provisioning-token>";
var vaultPolicy = "<existing-ceiling-policy>";
var mountAccessor = "<actual-OAuth-profile-accessor>";
var ceilingField = "ceiling_policies";
var vaultNamespace = "";



var tenantHost = "<Verify-tenant-hostname>";
var clientId = "<Verify-read-client-ID>";
var clientSecret = "<Verify-read-client-secret>";
var agentApiPath = "/v1.0/Agents";
function statusCode(status) {
  var m = String(status || "").match(/[0-9]+/);
  return m ? parseInt(m[0], 10) : 0;
}

function objectOrNull(v) {
  return (v && typeof v === "object") ? v : null;
}

function getAccessToken() {
  var tokenUrl = "https://" + tenantHost + "/oauth2/token";
  var body =
    "grant_type=client_credentials" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&client_secret=" + encodeURIComponent(clientSecret) +
    "&scope=" + encodeURIComponent("openid");

  var res = http.post({ headers: { "content-type": "application/x-www-form-urlencoded" } }, tokenUrl, body);
  logger.info("Verify token status=" + res.status);
  var tokenStatus = statusCode(res.status);
  if (tokenStatus < 200 || tokenStatus >= 300) {
    throw "Verify token failed status=" + res.status + " body=" + res.body;
  }
  return JSON.parse(res.body).access_token;
}

function readAgent(agentId) {
  var token = getAccessToken();
  var basePath = agentApiPath || "/v1.0/Agents";
  if (basePath.charAt(0) !== "/") basePath = "/" + basePath;
  var url = "https://" + tenantHost + basePath + "/" + encodeURIComponent(agentId);
  var res = http.get({
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/scim+json",
      "Content-Type": "application/scim+json",
      "x-forwarded-host": tenantHost
    }
  }, url);

  logger.info("Verify Agent GET status=" + res.status);

  var agentStatus = statusCode(res.status);
  if (agentStatus < 200 || agentStatus >= 300) {
    throw "Verify Agent read failed status=" + res.status + " body=" + res.body;
  }
  return JSON.parse(res.body);
}

var subjectFormat = "opaque";
if (subjectFormat !== "scim" && subjectFormat !== "opaque") throw "Invalid SUBJECT_FORMAT";
var PATCH = "urn:ietf:params:scim:event:prov:patch:full";
var CREATE = "urn:ietf:params:scim:event:prov:create:full";
var evt = null;
if (typeof claims === "string") claims = JSON.parse(claims);
var incoming = claims.events && (claims.events[PATCH] || claims.events[CREATE]);
if (incoming) {
  var subject = claims.sub_id || {};
  if (subject.format !== subjectFormat || !/^\/Agents\/[^/]+$/.test(subject.uri || "") || !claims.txn)
    throw "Invalid SCIM subject/transaction";
  var verifyId = decodeURIComponent(subject.uri.slice(8));
  if (subjectFormat === "opaque" && subject.id !== verifyId) throw "Opaque ID and URI mismatch";
  if (claims.events[PATCH]) {
    var patch = incoming.data || {};
    if (!patch.schemas || patch.schemas.length !== 1 ||
        patch.schemas[0] !== "urn:ietf:params:scim:api:messages:2.0:PatchOp" ||
        !Array.isArray(patch.Operations) || !patch.Operations.length) throw "Invalid PatchOp";
    patch.Operations.forEach(function(p) {
      if (p.op !== "replace" || !/^(displayName|description|externalIds|owners|tags|status|oauthClients)$/.test(p.path) ||
          !Object.prototype.hasOwnProperty.call(p,"value")) throw "Invalid replace operation";
    });
  }
  var current = readAgent(verifyId); // A failed read throws; never interpret failure as absence.
  if (current.id !== verifyId) throw "Agent GET ID mismatch";
  var validStates = ["ACTIVE", "SUSPENDED", "DRAFT", "UNDER_REVIEW"];
  if (validStates.indexOf(current.status) < 0) throw "Unknown/missing agent status; refusing Vault changes";
  var associations = current.oauthClients || [];
  if (!Array.isArray(associations)) throw "Invalid oauthClients response";
  var eligible = associations.filter(function(c) {
    return c && typeof c === "object" && c.clientId && Array.isArray(c.purposes) && c.purposes.indexOf("agent_id") >= 0;
  }).map(function(c) { return String(c.clientId); });
  if (eligible.length > 1) throw "This recipe supports one agent_id client; rotation needs alias reconciliation";
  logger.info("Eligibility status=" + current.status + " agent_id_clients=" + eligible.length);
  current.resourceType = "Agent";
  current.agentIdClientIds = eligible;
  if (current.status === "ACTIVE" && eligible.length === 0) {
    logger.info("SKIP ACTIVE agent: no explicit agent_id-purpose client; no Vault writes");
  } else {
    evt = {resource:current, operation: current.status === "ACTIVE" ? "upsert" : "delete"};
  }
}

if (!evt) {
  logger.info("No applicable action: unsupported event or ineligible ACTIVE agent. Skipping.");
} else {
  var resource = evt.resource || evt.agent || {};
  var resourceType = String(resource.resourceType || (resource.meta && resource.meta.resourceType) || "Agent");
  var agentId = String(resource.id || evt.agent_id || evt.agentId || "");
  var agentName = String(resource.displayName || resource.name || evt.agent_name || evt.agentName || agentId);
  var operation = String(evt.operation || "upsert").toLowerCase();

  if (resourceType && resourceType !== "Agent") {
    logger.info("Skipping non-Agent resourceType=" + resourceType);
  } else if (!agentId) {
    logger.info("Skipping event because IBM Verify Agent id is missing.");
  } else {
    function safeName(v) {
      return String(v || "").replace(/[^a-zA-Z0-9._-]/g, "-");
    }

    function firstNonEmpty(values) {
      for (var i = 0; i < values.length; i++) {
        if (values[i] !== undefined && values[i] !== null && String(values[i]) !== "") return String(values[i]);
      }
      return "";
    }

    function addAlias(aliasMap, v) {
      if (v !== undefined && v !== null && String(v) !== "") aliasMap[String(v)] = true;
    }

    // Vault Identity permits only one alias per entity for a given mount_accessor.
    // Therefore we choose exactly ONE primary runtime alias.
    // Priority: purpose-aware agent_id client -> raw management-event oauth_clients fallback -> explicit client fields -> non-agent runtime id -> agent id fallback.
    function getRuntimeAliases() {
      function push(out, v) {
        if (v !== undefined && v !== null && String(v) !== "") out.push(String(v));
      }
      function firstUnique(list) {
        var seen = {};
        for (var i = 0; i < list.length; i++) {
          var v = String(list[i] || "");
          if (!v || seen[v]) continue;
          seen[v] = true;
          return v;
        }
        return "";
      }

      var candidates = [];

      // Preferred: mapper provides purpose-aware oauthClients where purposes contains agent_id.
      var agentIdClients = resource.agentIdClientIds || resource.agent_id_client_ids || [];
      if (agentIdClients && agentIdClients.length) {
        for (var aic = 0; aic < agentIdClients.length; aic++) push(candidates, agentIdClients[aic]);
      }

      // Fallback: raw management event data.oauth_clients only contains client id strings.
      var rawIds = resource.rawOAuthClientIds || resource.raw_oauth_client_ids || resource.oauth_client_ids || [];
      if (rawIds && rawIds.length) {
        for (var ric = 0; ric < rawIds.length; ric++) push(candidates, rawIds[ric]);
      }

      // Object-style oauth clients with purpose=agent_id.
      var arrays = [resource.oauthClients, resource.oauth_clients, resource.clients, resource.applications, resource.authMethods, resource.authenticationMethods];
      for (var arr = 0; arr < arrays.length; arr++) {
        var list = arrays[arr];
        if (!list || !list.length) continue;
        for (var j = 0; j < list.length; j++) {
          var item = list[j] || {};
          if (typeof item === "string") { push(candidates, item); continue; }
          var hasPurpose = false;
          var purposes = item.purposes || [];
          if (purposes && purposes.length) {
            for (var pp = 0; pp < purposes.length; pp++) {
              if (String(purposes[pp]).toLowerCase() === "agent_id") hasPurpose = true;
            }
          }
          if (String(item.purpose || "").toLowerCase() === "agent_id") hasPurpose = true;
          if (!hasPurpose) continue;
          push(candidates, item.clientId);
          push(candidates, item.client_id);
          push(candidates, item.id);
          push(candidates, item.applicationId);
          push(candidates, item.application_id);
          push(candidates, item.subject);
        }
      }

      push(candidates, resource.clientId);
      push(candidates, resource.client_id);
      push(candidates, evt.runtime_subject);
      push(candidates, resource.runtimeSubject);
      push(candidates, resource.runtime_subject);
      push(candidates, resource.subject);

      var ids = resource.runtimeIdentifiers || resource.runtime_identifiers || [];
      if (ids && ids.length) {
        for (var ri = 0; ri < ids.length; ri++) {
          // Avoid choosing the Verify Agent ID if a real OAuth client id is available.
          if (String(ids[ri]) !== String(agentId)) push(candidates, ids[ri]);
        }
      }

      // Last fallback only; useful when no OAuth client id is available.
      push(candidates, agentId);

      var chosen = firstUnique(candidates);
      if (!chosen) return [];
      return [chosen];
    }

    function headers() {
      var h = {
        "X-Vault-Token": vaultToken,
        "Content-Type": "application/json"
      };
      if (vaultNamespace) h["X-Vault-Namespace"] = vaultNamespace;
      return h;
    }

    function vaultGet(path) {
      var res = http.get({ headers: headers() }, vaultAddr + "/v1/" + path);
      logger.info("Vault GET " + path + " status=" + res.status + " body=" + res.body);
      if (statusCode(res.status) < 200 || statusCode(res.status) >= 300) {
        var err = new Error("Vault GET failed path=" + path + " status=" + res.status); err.status = statusCode(res.status); throw err;
      }
      return res.body ? JSON.parse(res.body) : {};
    }

    function vaultPost(path, body) {
      var res = http.post({ headers: headers() }, vaultAddr + "/v1/" + path, JSON.stringify(body || {}));
      logger.info("Vault POST " + path + " status=" + res.status + " body=" + res.body);
      if (statusCode(res.status) < 200 || statusCode(res.status) >= 300) {
        var err = new Error("Vault POST failed path=" + path + " status=" + res.status); err.status = statusCode(res.status); throw err;
      }
      return res.body ? JSON.parse(res.body) : {};
    }

    function vaultDelete(path) {
      var url = vaultAddr + "/v1/" + path;
      var res = null;

      if (typeof http["delete"] === "function") {
        res = http["delete"]({ headers: headers() }, url);
      } else if (typeof http.del === "function") {
        res = http.del({ headers: headers() }, url);
      } else if (typeof http.request === "function") {
        res = http.request({ method: "DELETE", headers: headers() }, url, "");
      } else {
        throw "Antenna http helper does not expose DELETE. Add DELETE support or call Vault delete through a small proxy.";
      }

      logger.info("Vault DELETE " + path + " status=" + res.status + " body=" + res.body);
      if (statusCode(res.status) < 200 || statusCode(res.status) >= 300) {
        throw "Vault DELETE failed path=" + path + " status=" + res.status + " body=" + res.body;
      }
      return res.body ? JSON.parse(res.body) : {};
    }

    function lookupEntityIdByAlias(aliasName) {
      try {
        var lookup = vaultPost("identity/lookup/entity", {
          alias_name: aliasName,
          alias_mount_accessor: mountAccessor
        });
        return lookup && lookup.data ? String(lookup.data.id || "") : "";
      } catch (e) {
        if (e.status === 404) return "";
        throw e;
      }
    }

    function getEntityByName(entityName) {
      try {
        var existing = vaultGet("identity/entity/name/" + encodeURIComponent(entityName));
        if (existing && existing.data && existing.data.id) return existing.data;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      return null;
    }

    function getRegistrationByEntityId(entityId) {
      try {
        var reg = vaultGet("agent-registry/registration/entity-id/" + encodeURIComponent(entityId));
        if (reg && reg.data && reg.data.id) return reg.data;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      return null;
    }

    function registryPayload(entityId) {
      var display = firstNonEmpty([resource.vaultDisplayName, resource.vault_display_name, agentName, agentId]);
      var owner = "";
      if (resource.owner) owner = String(resource.owner);
      else if (resource.owners && resource.owners.length) {
        if (typeof resource.owners[0] === "string") owner = String(resource.owners[0]);
        else owner = String(resource.owners[0].displayName || resource.owners[0].name || resource.owners[0].id || "");
      }

      var payload = {
        display_name: display,
        entity_id: entityId,
        description: firstNonEmpty([resource.description, resource.purpose, "IBM Verify Agent " + agentName]),
        owner: owner || "ibm-verify",
        optional_authorization_details: false
      };
      payload[ceilingField] = [vaultPolicy];
      return payload;
    }

    function upsertAliases(entityId, aliases) {
      for (var i = 0; i < aliases.length; i++) {
        var alias = aliases[i];
        var existingEntityId = lookupEntityIdByAlias(alias);
        if (existingEntityId) {
          if (existingEntityId === entityId) {
            logger.info("Alias already exists on same entity. Skipping create. alias=" + alias + " entity=" + entityId);
            continue;
          }
          throw "Alias " + alias + " already belongs to another entity " + existingEntityId + ". Refusing to remap automatically.";
        }

        vaultPost("identity/entity-alias", {
          name: alias,
          canonical_id: entityId,
          mount_accessor: mountAccessor,
          custom_metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            verify_agent_id: agentId,
            verify_agent_display_name: agentName
          }
        });
        logger.info("Alias created alias=" + alias + " entity=" + entityId);
      }
    }

    function upsertAgentRegistry(entityId) {
      var payload = registryPayload(entityId);
      var existingReg = getRegistrationByEntityId(entityId);

      if (existingReg && existingReg.id) {
        vaultPost("agent-registry/registration/id/" + encodeURIComponent(existingReg.id), payload);
        logger.info("Agent Registry updated registrationId=" + existingReg.id + " entity=" + entityId);
      } else {
        var created = vaultPost("agent-registry/register", payload);
        logger.info("Agent Registry created body=" + JSON.stringify(created));
      }
    }

    function disableEntityAndDeleteRegistry(entityId) {
      vaultPost("identity/entity/id/" + encodeURIComponent(entityId), {disabled:true});
      var existingReg = getRegistrationByEntityId(entityId);
      if (existingReg && existingReg.id) {
        vaultDelete("agent-registry/registration/id/" + encodeURIComponent(existingReg.id));
        logger.info("Agent Registry deleted registrationId=" + existingReg.id + " entity=" + entityId);
      } else {
        logger.info("No Agent Registry record to delete for entity=" + entityId);
      }

      vaultPost("identity/entity/id/" + encodeURIComponent(entityId), {
        disabled: true,
        metadata: {
          source: "ibm-verify-antenna",
          resource_type: "Agent",
          verify_agent_id: agentId,
          verify_agent_display_name: agentName,
          deprovisioned: "true"
        }
      });
      logger.info("Entity disabled entity=" + entityId + " verifyAgentId=" + agentId);
    }

    logger.info("operation=" + operation + " verifyAgentId=" + agentId + " verifyAgentName=" + agentName);

    var aliases = getRuntimeAliases();
    logger.info("runtime aliases=" + aliases.join(","));

    if (operation === "delete" || operation === "disable" || operation === "disabled") {
      logger.info("DELETE FLOW START");
      var deleteEntityId = "";

      if (!deleteEntityId) {
        var deleteEntityName = "verify-agent-" + safeName(agentId);
        var deleteEntity = getEntityByName(deleteEntityName);
        if (deleteEntity && deleteEntity.id) deleteEntityId = deleteEntity.id;
      }

      if (!deleteEntityId) {
        logger.info("DELETE SKIPPED no entity found for verifyAgentId=" + agentId + " aliases=" + aliases.join(","));
      } else {
        disableEntityAndDeleteRegistry(deleteEntityId);
        logger.info("DELETE FLOW COMPLETE entity=" + deleteEntityId + " verifyAgentId=" + agentId);
      }
    } else {
      logger.info("UPSERT FLOW START");

      // Stable entity name is based on IBM Verify Agent UUID, not display name, so renames do not create duplicates.
      var entityName = "verify-agent-" + safeName(agentId);
      var entity = getEntityByName(entityName);
      var entityId = entity ? entity.id : "";
      // Rotation must not leave a previously authorized client alias active.
      if (entity && entity.aliases) entity.aliases.forEach(function(a) {
        if (a.mount_accessor === mountAccessor && aliases.indexOf(a.name) < 0)
          throw "Stale runtime alias found; reconcile aliases before re-enabling";
      });

      if (!entityId) {
        var createdEntity = vaultPost("identity/entity", {
          name: entityName,
          policies: [],
          disabled: false,
          metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            verify_agent_id: agentId,
            verify_agent_display_name: agentName,
            verify_agent_status: String(resource.status || ""),
            deprovisioned: "false"
          }
        });
        entityId = createdEntity.data.id;
        logger.info("Created entity=" + entityId + " name=" + entityName);
      } else {
        vaultPost("identity/entity/id/" + encodeURIComponent(entityId), {
          name: entityName,
          policies: [],
          disabled: false,
          metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            verify_agent_id: agentId,
            verify_agent_display_name: agentName,
            verify_agent_status: String(resource.status || ""),
            deprovisioned: "false"
          }
        });
        logger.info("Updated/re-enabled entity=" + entityId + " name=" + entityName);
      }

      upsertAliases(entityId, aliases);
      upsertAgentRegistry(entityId);
      logger.info("UPSERT FLOW COMPLETE entity=" + entityId + " verifyAgentId=" + agentId);
    }
  }
}
