importClass(logger);
importClass(http);

logger.info("----- vault_entity_alias_action.js SCIM AGENT UPSERT DELETE -----");
logger.info("eventStr=" + eventStr);

var wrapper = JSON.parse(eventStr);
var claims = wrapper.claimsJson ? wrapper.claimsJson : wrapper;

var eventType1 = "${SESSION_EVENT}";
var eventType2 = "https://schemas.ibm.com/verify/event-type/agent-sync";
var evt = null;

if (claims.events) {
  evt = claims.events[eventType1] || claims.events[eventType2];
}

if (!evt) {
  logger.info("No supported event found. Skipping.");
} else {
  /*
   * Preferred contract: evt.resource is a minimal SCIM-like Agent resource:
   * {
   *   "schemas": ["urn:ietf:params:scim:schemas:extension:ibm:2.0:Agent"],
   *   "resourceType": "Agent",
   *   "id": "...",
   *   "name": "..."
   * }
   *
   * Backward compatibility is kept for older pack events that used:
   * application_id/application_name.
   */
  var resource = evt.resource || evt.agent || {};

  var resourceType = String(resource.resourceType || (resource.meta && resource.meta.resourceType) || "");
  var agentId = String(resource.id || evt.agent_id || evt.application_id || evt.applicationId || "");
  var agentName = String(resource.name || resource.displayName || evt.agent_name || evt.application_name || evt.applicationName || agentId);
  var operation = String(evt.operation || "upsert").toLowerCase();

  if (resourceType && resourceType !== "Agent") {
    logger.info("Skipping non-Agent resourceType=" + resourceType);
  } else if (!agentId) {
    logger.info("Skipping event because Agent id is missing.");
  } else {
    var vaultAddr = "${VAULT_ADDR}";
    var vaultToken = "${VAULT_TOKEN}";
    var vaultPolicy = "${VAULT_POLICY}";
    var mountAccessor = "${VAULT_MOUNT_ACCESSOR}";

    function safeName(v) {
      return String(v || "").replace(/[^a-zA-Z0-9._-]/g, "-");
    }

    function vaultGet(path) {
      var res = http.get({
        headers: {
          "X-Vault-Token": vaultToken,
          "Content-Type": "application/json"
        }
      }, vaultAddr + "/v1/" + path);

      logger.info("Vault GET " + path + " status=" + res.status + " body=" + res.body);

      if (res.status < 200 || res.status >= 300) {
        throw "Vault GET failed status=" + res.status + " body=" + res.body;
      }

      return res.body ? JSON.parse(res.body) : {};
    }

    function vaultPost(path, body) {
      var res = http.post({
        headers: {
          "X-Vault-Token": vaultToken,
          "Content-Type": "application/json"
        }
      }, vaultAddr + "/v1/" + path, JSON.stringify(body || {}));

      logger.info("Vault POST " + path + " status=" + res.status + " body=" + res.body);

      if (res.status < 200 || res.status >= 300) {
        throw "Vault POST failed status=" + res.status + " body=" + res.body;
      }

      return res.body ? JSON.parse(res.body) : {};
    }

    logger.info("operation=" + operation + " agentId=" + agentId + " agentName=" + agentName + " resourceType=" + (resourceType || "Agent"));

    if (operation === "delete" || operation === "disable") {
      logger.info("DELETE/DISABLE FLOW START");

      var lookup = vaultPost("identity/lookup/entity", {
        alias_name: agentId,
        alias_mount_accessor: mountAccessor
      });

      var entityId = lookup && lookup.data ? lookup.data.id : "";

      if (!entityId) {
        logger.info("DELETE/DISABLE SKIPPED no entity found for alias=" + agentId);
      } else {
        vaultPost("identity/entity/id/" + entityId, {
          disabled: true,
          metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            agent_id: agentId,
            agent_name: agentName,
            deprovisioned: "true"
          }
        });

        logger.info("DELETE/DISABLE COMPLETE disabled entity=" + entityId + " alias=" + agentId);
      }

    } else {
      logger.info("UPSERT FLOW START");

      var entityName = "verify-agent-" + safeName(agentName);
      var entityId = "";

      try {
        var existing = vaultGet("identity/entity/name/" + entityName);
        if (existing && existing.data && existing.data.id) {
          entityId = existing.data.id;
          logger.info("Entity exists=" + entityId);
        }
      } catch (e) {
        logger.info("Entity not found; creating new one.");
      }

      if (!entityId) {
        var created = vaultPost("identity/entity", {
          name: entityName,
          policies: [vaultPolicy],
          disabled: false,
          metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            agent_id: agentId,
            agent_name: agentName,
            deprovisioned: "false"
          }
        });

        entityId = created.data.id;
        logger.info("Created entity=" + entityId);
      } else {
        vaultPost("identity/entity/id/" + entityId, {
          disabled: false,
          policies: [vaultPolicy],
          metadata: {
            source: "ibm-verify-antenna",
            resource_type: "Agent",
            agent_id: agentId,
            agent_name: agentName,
            deprovisioned: "false"
          }
        });
        logger.info("Re-enabled/updated entity=" + entityId);
      }

      vaultPost("identity/entity-alias", {
        name: agentId,
        canonical_id: entityId,
        mount_accessor: mountAccessor
      });

      logger.info("UPSERT COMPLETE entity=" + entityId + " alias=" + agentId);
    }
  }
}
