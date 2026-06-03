importClass(logger);
importClass(http);

var outputData = {};
var inputData = JSON.parse(eventStr);

logger.info("----- verify_app_agent_mapper.js SCIM AGENT PAYLOAD -----");
logger.info("Raw eventStr=" + eventStr);

var tenantHost = "${VERIFY_TENANT_HOST}";
var clientId = "${VERIFY_CLIENT_ID}";
var clientSecret = "${VERIFY_CLIENT_SECRET}";

function getPath(o, path) {
  var cur = o;
  for (var i = 0; i < path.length; i++) {
    if (!cur || cur[path[i]] === undefined || cur[path[i]] === null) return "";
    cur = cur[path[i]];
  }
  return cur;
}

function extractAppId(e) {
  return String(
    getPath(e, ["data", "applicationid"]) ||
    getPath(e, ["data", "applicationId"]) ||
    e.applicationid ||
    e.applicationId ||
    ""
  );
}

function extractAppName(e, appId) {
  return String(
    getPath(e, ["data", "applicationname"]) ||
    getPath(e, ["data", "applicationName"]) ||
    e.applicationname ||
    e.applicationName ||
    appId
  );
}

function extractCompanyNameFromModified(e) {
  var modified = getPath(e, ["data", "modified"]);
  if (modified) {
    try {
      var arr = JSON.parse(modified);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].companyName && arr[i].companyName.new !== undefined) {
          return String(arr[i].companyName.new);
        }
      }
    } catch (x) {
      logger.info("modified parse failed=" + x);
    }
  }
  return "";
}

function getAccessToken() {
  var tokenUrl = "https://" + tenantHost + "/v1.0/endpoint/default/token";
  var body =
    "grant_type=client_credentials" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&client_secret=" + encodeURIComponent(clientSecret) +
    "&scope=" + encodeURIComponent("openid");

  var res = http.post({
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    }
  }, tokenUrl, body);

  logger.info("Verify token status=" + res.status);

  if (res.status < 200 || res.status >= 300) {
    throw "Verify token failed status=" + res.status + " body=" + res.body;
  }

  return JSON.parse(res.body).access_token;
}

function readApplicationCompanyName(appId) {
  var token = getAccessToken();
  var url = "https://" + tenantHost + "/v1.0/applications/" + appId;

  var res = http.get({
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/json",
      "x-forwarded-host": tenantHost
    }
  }, url);

  logger.info("Verify application GET status=" + res.status);
  logger.info("Verify application GET body=" + res.body);

  if (res.status < 200 || res.status >= 300) {
    throw "Verify application read failed status=" + res.status + " body=" + res.body;
  }

  var app = JSON.parse(res.body);
  var companyName = "";

  if (app.companyName) companyName = String(app.companyName);

  if (!companyName && app.providers && app.providers.saml && app.providers.saml.properties) {
    companyName = String(app.providers.saml.properties.companyName || "");
  }

  if (!companyName && app.providers && app.providers.oidc && app.providers.oidc.properties) {
    companyName = String(app.providers.oidc.properties.companyName || "");
  }

  if (!companyName && app.additionalConfig) {
    companyName = String(app.additionalConfig.companyName || "");
  }

  return companyName;
}

/*
 * IMPORTANT DESIGN CHOICE
 * -----------------------
 * The source event today is still an IBM Verify application audit event.
 * The payload we emit is no longer application-shaped.
 *
 * We emit a minimal SCIM-like Agent resource so the receiver does not care
 * whether tomorrow's source is an application audit event or a real agent
 * registry / agent audit event.
 *
 * Only the Vault-relevant fields are emitted:
 *   - resourceType = Agent
 *   - id           = stable agent identifier
 *   - name         = human-readable agent name
 */
function buildScimAgentResource(agentId, agentName) {
  return {
    schemas: [
      "urn:ietf:params:scim:schemas:extension:ibm:2.0:Agent"
    ],
    resourceType: "Agent",
    id: String(agentId),
    name: String(agentName || agentId)
  };
}

var appId = extractAppId(inputData);
var appName = extractAppName(inputData, appId);
var companyName = extractCompanyNameFromModified(inputData);
var source = "modified";

if (!appId) {
  logger.info("No appId found. No SSF event.");
  outputData.ssfEvents = [];
} else {
  if (!companyName) {
    logger.info("companyName not present in modified payload. Reading current application from Verify.");
    companyName = readApplicationCompanyName(appId);
    source = "verify-api";
  }

  var operation = String(companyName).toLowerCase() === "agent" ? "upsert" : "delete";
  var eventType = "${SESSION_EVENT}";
  var agent = buildScimAgentResource(appId, appName);

  var ssf = {
    sub_id: {
      format: "email",
      email: agent.id + "@verify-agent.local",
      verifyUserId: agent.id
    },
    events: {}
  };

  ssf.events[eventType] = {
    event_timestamp: Math.floor(Date.now() / 1000),

    /*
     * SCIM Agent payload.
     * The receiver should use this object as the contract.
     */
    resource: agent,

    /*
     * Kept outside the SCIM resource because it is an event action,
     * not an Agent attribute.
     */
    operation: operation,

    /*
     * Minimal trace metadata only. Vault logic should not depend on this.
     */
    source: {
      system: "ibm-verify",
      event_source: "application-audit",
      classification_attribute: "companyName",
      classification_value: String(companyName),
      classification_source: source
    }
  };

  logger.info("Generated SCIM Agent event id=" + agent.id + " name=" + agent.name + " companyName=" + companyName + " source=" + source + " operation=" + operation);
  outputData.ssfEvents = [ssf];
}
