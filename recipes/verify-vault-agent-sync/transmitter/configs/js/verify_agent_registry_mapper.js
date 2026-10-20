// CONFIGURATION: edit the placeholder values below before deployment.
// Subject mode is explicitly opaque in BOTH handlers; no renderer/environment file is required.
importClass(logger);
importClass(http);
var outputData = {ssfEvents: []};
var inputData = JSON.parse(eventStr);
var tenantHost = "<Verify-tenant-hostname>";
var clientId = "<Verify-read-client-ID>";
var clientSecret = "<Verify-read-client-secret>";
var agentApiPath = "/v1.0/Agents";
var subjectFormat = "opaque";
if (subjectFormat !== "scim" && subjectFormat !== "opaque") throw "Invalid SUBJECT_FORMAT";
var PATCH = "urn:ietf:params:scim:event:prov:patch:full";
var CREATE = "urn:ietf:params:scim:event:prov:create:full";
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


function mapModification(modified) {
  if (typeof modified === "string") modified = JSON.parse(modified);
  var out = [];
  function add(path, change) {
    if (!/^(displayName|description|externalIds|owners|tags|status|oauthClients)$/.test(path))
      throw "Unsupported modified attribute: " + path;
    if (!change || !Object.prototype.hasOwnProperty.call(change, "new"))
      throw "Modified attribute has no new value: " + path;
    out.push({op:"replace", path:path, value:change.new});
  }
  if (Array.isArray(modified)) {
    modified.forEach(function(c) {
      if (!c || typeof c !== "object") throw "Invalid modified entry";
      if (c.name || c.attribute || c.path) add(c.name || c.attribute || c.path, c);
      else Object.keys(c).forEach(function(k) { add(k,c[k]); });
    });
  } else if (modified && typeof modified === "object") {
    Object.keys(modified).forEach(function(k) { add(k, modified[k]); });
  } else throw "Missing or invalid data.modified";
  if (!out.length) throw "Empty modification";
  return out;
}
var d = inputData.data || {};
if (inputData.event_type === "management" && d.resource === "ai_agent" && d.result === "success" &&
    (d.action === "modified" || d.action === "created")) {
  // Do not use the audit event ID as the resource ID.
  var id = d.id || d.agentId || d.agentid;
  var txn = inputData.txn || inputData.id;
  if (!id || typeof id !== "string" || !txn) throw "Agent ID or audit transaction/event ID missing";
  var subject = {format:subjectFormat, uri:"/Agents/"+encodeURIComponent(id)};
  if (subjectFormat === "opaque") subject.id = id;
  var set = {sub_id:subject, txn:String(txn), events:{}};
  if (d.action === "modified") {
    set.events[PATCH] = {data:{schemas:["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
      Operations:mapModification(d.modified)}};
  } else {
    var current = readAgent(id);
    if (current.id !== id) throw "Agent GET ID mismatch";
    set.events[CREATE] = {data:current};
  }
  outputData.ssfEvents = [set];
}

logger.info("Agent mapper emitted=" + outputData.ssfEvents.length + " subjectFormat=" + subjectFormat);
