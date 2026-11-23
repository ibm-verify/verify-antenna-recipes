// Sample transformation of a IBM Verify Identity Protection event structure to corresponding SSF events.
// @input event structure for compromised email
//    {
//      "flow_count": 1,
//      "incident_count": 1,
//      "incidents_url": "https://console.idprotection.verify.ibm.com/issues?q=...",
//      "issue_details_api": "https://console.idprotection.verify.ibm.com/amapi/v1/getIssueDetails?issue_id=185321-1759453163438",
//      "issue_id": "185321-1759453163438",
//      "issue_keys": {
//        "identity_name": "Anthony.Galiamov@ibm.com"
//      },
//      "issue_time": "2025-10-03T00:52:58Z",
//      "issue_type": "Compromised User",
//      "message": "Anthony.Galiamov@ibm.com's email address was found in one or more data breaches",
//      "playbook_name": "Compromised User",
//      "risk": "Critical"
//    }
//
// @input event structure for unauthorized access
//    {
//      "flow_count": 2,
//      "incident_count": 1,
//      "incidents_url": "https://console.idprotection.verify.ibm.com/issues?q=...",
//      "issue_details_api": "https://console.idprotection.verify.ibm.com/amapi/v1/getIssueDetails?issue_id=183682-1759257494100",
//      "issue_id": "183682-1759257494100",
//      "issue_keys": {
//        "asset_country_name": "Ukraine",
//        "identity_name": "aline.karlovic@authmind.com"
//      },
//      "issue_time": "2025-09-30T18:26:23Z",
//      "issue_type": "Access to Unauthorized Countries",
//      "message": "aline.karlovic@authmind.com accessed Ukraine which is flagged as unauthorized",
//      "playbook_name": "Access to Unauthorized Countries",
//      "risk": "High"
//    }
//
// @input event structure for unregistered agent detected
//    {
//      "issue_id": "agent-unregistered-1792062937356",
//      "issue_keys": {
//        "authmind_agent_id": "am-agent-7f3c1d",
//        "agent_external_id": "spiffe://dune.spire.local/trade-agent-alpha",
//        "identity_id": "8120028SFS"
//      },
//      "issue_time": "2026-10-15T11:15:37Z",
//      "issue_type": "Unregistered Agent Detected",
//      "playbook_name": "Unregistered Agent Detected",
//      "message": "Agent 'Trade Agent Alpha' was observed making API calls but has no registration in IBM Verify.",
//      "risk": "High",
//      "agent": {
//        "displayName": "Trade Agent Alpha",
//        "description": "Trade Agent for Execution",
//        "externalIds": ["spiffe://dune.spire.local/trade-agent-alpha"],
//        "owners": [{ "value": "8120028SFS", "type": "User" }],
//        "tags": ["langflow", "trade-agent"]
//      }
//    }
//
// @input event structure for anomalous agent access
//    {
//      "issue_id": "183700-1792062937356",
//      "issue_keys": {
//        "agent_id": "am-agent-7f3c1d",
//        "identity_id": "8120028SFS",
//        "asset_type": "database",
//        "asset_id": "prod-db-01",
//        "ip_address": "192.168.55.21"
//      },
//      "issue_time": "2026-10-15T11:15:37Z",
//      "issue_type": "Anomalous Agent Access",
//      "playbook_name": "AI Agents Accessing Unapproved Asset",
//      "message": "Agent 'am-agent-7f3c1d' accessed production database 'prod-db-01' outside its approved resource scope.",
//      "risk": "High",
//      "incident_timestamps": [1792062900000, 1792062910000, 1792062937356]
//    }
//
// @input event structure for agent with invalid/missing owner
//    {
//      "issue_id": "183701-1792062937400",
//      "issue_keys": {
//        "agent_id": "01a0d2f7-a9c8-7a8d-a6f1-abc591a7d58b",
//        "agent_external_id": "spiffe://dune.spire.local/trade-agent-alpha",
//        "identity_id": "8120028SFS"
//      },
//      "issue_time": "2026-10-15T11:16:00Z",
//      "issue_type": "Agent Invalid Owner",
//      "playbook_name": "Agent with Missing or Invalid Owner",
//      "message": "Agent 'Trade Agent Alpha' has no valid owner — the previously assigned account '8120028SFS' has been deactivated.",
//      "risk": "High",
//      "previous_owner": { "value": "8120028SFS", "type": "User" }
//    }

importClass(logger);

// General
let defaultLog = logger.info;
let debugLog = logger.debug;

// Debug logs to trace whatever is received
debugLog("====== Executing the vip_event_mapper transformation handler ======")
defaultLog(`[trace] Raw event received: ${eventStr}`);
debugLog("===================================================================")

// Define SSF event classes to make this somewhat well-structured.
class Subject {
    format = "opaque";
    constructor(format, opts = {}) {
        this.format = format;
        Object.assign(this, opts);
    }
}

class ComplexSubject {
    format = "complex";
    constructor(components = {}) {
        Object.assign(this, components);
    }
}

class SSFEvent {
    constructor(event_type, reason_admin, reason_user, event_timestamp) {
        this.event_type = event_type;
        this.reason_admin = reason_admin;
        this.reason_user = reason_user;
        this.event_timestamp = event_timestamp;
    }
}

// Custom IBM Verify agent event URIs.
const IBM_VERIFY_UNREGISTERED_AGENT = "urn:ibm:agent:unregistered_agent";
const IBM_VERIFY_ANOMALOUS_ACCESS    = "urn:ibm:agent:anomalous_access";
const IBM_VERIFY_INVALID_OWNER       = "urn:ibm:agent:invalid_owner";
const SCIM_AGENT_SCHEMA              = "urn:ietf:params:scim:schemas:core:ibm:2.0:Agent";

// Unregistered agent: agent fields wrapped in "data" so the playbook can read them
class UnregisteredAgentEvent {
    constructor(opts = {}) {
        Object.defineProperty(this, "event_type", { value: IBM_VERIFY_UNREGISTERED_AGENT, enumerable: false });
        this.data = opts.data;
        if (opts.reason_admin)    this.reason_admin    = opts.reason_admin;
        if (opts.event_timestamp) this.event_timestamp = opts.event_timestamp;
    }
}

// Anomalous access: asset_type + asset_id required; event_timestamp, incident_timestamps, reason_admin optional.
class AnomalousAccessEvent {
    constructor(opts = {}) {
        Object.defineProperty(this, "event_type", { value: IBM_VERIFY_ANOMALOUS_ACCESS, enumerable: false });
        this.asset_type = opts.asset_type;
        this.asset_id   = opts.asset_id;
        if (opts.incident_timestamps) this.incident_timestamps = opts.incident_timestamps;
        if (opts.reason_admin)        this.reason_admin        = opts.reason_admin;
        if (opts.event_timestamp)     this.event_timestamp     = opts.event_timestamp;
    }
}

// Invalid owner: signal-only event — no new owner carried.
class InvalidOwnerEvent {
    constructor(opts = {}) {
        Object.defineProperty(this, "event_type", { value: IBM_VERIFY_INVALID_OWNER, enumerable: false });
        if (opts.previous_owner)  this.previous_owner  = opts.previous_owner;
        if (opts.reason_admin)    this.reason_admin    = opts.reason_admin;
        if (opts.event_timestamp) this.event_timestamp = opts.event_timestamp;
    }
}

class CredentialCompromiseEvent extends SSFEvent {
    credential_type = "email";
    constructor(opts = {}) {
        super("https://schemas.openid.net/secevent/risc/event-type/credential-compromise", opts.reason_admin, opts.reason_user, opts.event_timestamp);
        this.credential_type = opts.credential_type;
    }
}

class RiskLevelChangeEvent extends SSFEvent {
    principal = "USER"
    constructor(opts = {}) {
        super("https://schemas.openid.net/secevent/caep/event-type/risk-level-change", opts.reason_admin, opts.reason_user, opts.event_timestamp);
        this.risk_reason = opts.risk_reason;
        this.previous_level = opts.previous_level || "LOW";
        this.current_level = opts.current_level;
        this.principal = opts.principal;
    }
}

class SET {
    constructor(sub_id, events) {
        this.sub_id = sub_id;
        this.events = {};
        events.forEach((event) => {
            this.events[event.event_type] = event;
        });
    }
}

let outputData = {};

// Transform the raw event received
function transformCompromisedUserEvent(subject, rawEvent) {
    if (rawEvent.risk != "Critical" && rawEvent.risk != "High") {
        return null;
    }

    const keys     = rawEvent.issue_keys || {};
    const identity = keys.identity_id || keys.identity_name || "unknown";
    const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity);
    const adminReason = "Credentials for agent owner were found in one or more data breaches";

    const events = [
        new CredentialCompromiseEvent({
            "reason_admin": { "en": adminReason },
            "reason_user":  { "en": "Your account has been compromised" },
            "event_timestamp": new Date(rawEvent.issue_time).getTime(),
            "credential_type": isEmail ? "email" : "password"
        })
    ];

    const payload = new SET(subject, events);
    return payload;
}

// Builds a user Subject, preferring identity_id (opaque IBM Verify user ID) over identity_name
function buildUserSubject(keys) {
    if (keys.identity_id) {
        return new Subject("opaque", { "id": keys.identity_id });
    } else if (keys.identity_name) {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(keys.identity_name);
        return isEmail
            ? new Subject("email",  { "email": keys.identity_name })
            : new Subject("opaque", { "id":    keys.identity_name });
    }
    return null;
}

// issue_type "Unregistered Agent Detected" → urn:ibm:agent:unregistered_agent
function transformUnregisteredAgentEvent(rawEvent) {
    let sourceAgentId = rawEvent.issue_keys.authmind_agent_id;
    let agent = rawEvent.agent;
    if (!sourceAgentId || !agent || !agent.displayName) {
        return null;
    }

    let externalId = rawEvent.issue_keys.agent_external_id || (agent.externalIds && agent.externalIds[0]);
    let subjectOpts = { "uri": `/Agents/${sourceAgentId}` };
    if (externalId) subjectOpts.externalId = externalId;
    let subject = new Subject("scim", subjectOpts);

    let data = {
        "schemas": [SCIM_AGENT_SCHEMA],
        "displayName": agent.displayName
    };
    ["description", "externalIds", "owners", "tags"].forEach((attr) => {
        if (agent[attr] !== undefined && agent[attr] !== null) data[attr] = agent[attr];
    });

    let event = new UnregisteredAgentEvent({
        "data": data,
        "reason_admin":    { "en": rawEvent.message },
        "event_timestamp": new Date(rawEvent.issue_time).getTime()
    });

    return new SET(subject, [event]);
}

// issue_type "Anomalous Agent Access" → urn:ibm:agent:anomalous_access
function transformAnomalousAccessEvent(rawEvent) {
    let keys = rawEvent.issue_keys;
    if (!keys.agent_id || !keys.asset_type || !keys.asset_id) {
        return null;
    }

    let userSubject = buildUserSubject(keys);
    let components = {
        "agent": new Subject("opaque", { "id": keys.agent_id })
    };
    if (userSubject)    components.user    = userSubject;
    if (keys.ip_address) components.session = new Subject("opaque", { "id": keys.ip_address });
    let subject = new ComplexSubject(components);

    let event = new AnomalousAccessEvent({
        "asset_type":          keys.asset_type,
        "asset_id":            keys.asset_id,
        "incident_timestamps": rawEvent.incident_timestamps || undefined,
        "reason_admin":        { "en": rawEvent.message },
        "event_timestamp":     new Date(rawEvent.issue_time).getTime()
    });

    return new SET(subject, [event]);
}

// issue_type "Agent Invalid Owner" → urn:ibm:agent:invalid_owner
function transformInvalidOwnerEvent(rawEvent) {
    let keys = rawEvent.issue_keys;
    if (!keys.agent_id) {
        return null;
    }

    let subject = new Subject("opaque", { "id": keys.agent_id });

    let eventOpts = {
        "reason_admin":    { "en": rawEvent.message },
        "event_timestamp": new Date(rawEvent.issue_time).getTime()
    };
    if (rawEvent.previous_owner) eventOpts.previous_owner = rawEvent.previous_owner;

    return new SET(subject, [new InvalidOwnerEvent(eventOpts)]);
}

function transformAccessToUnauthorizedCountriesEvent(subject, rawEvent) {
    if (rawEvent.risk != "Critical" && rawEvent.risk != "High") {
        return null;
    }

    let events = [
        new RiskLevelChangeEvent({
            "reason_admin": {
                "en": rawEvent.message
            },
            "reason_user": {
                "en": "Your account is being used to perform unauthorized activities"
            },
            "event_timestamp":  new Date(rawEvent.issue_time).getTime(),
            "risk_reason": rawEvent.message,
            "current_level": "HIGH",
            "principal": "USER"
        })
    ];

    const payload = new SET(subject, events);
    return payload;
}

function main() {
    let rawEvent = JSON.parse(eventStr);

    // Unregistered agent: SCIM subject
    if (rawEvent.issue_type == "Unregistered Agent Detected") {
        outputData["ssfEvents"] = [];
        let set = transformUnregisteredAgentEvent(rawEvent);
        if (set != null) outputData["ssfEvents"].push(set);
        return;
    }

    // Guard: issue_keys must be present for remaining event types.
    if (!rawEvent.issue_keys) {
        defaultLog(`[warn] Unrecognised event shape (no issue_keys), issue_type=${rawEvent.issue_type || "unknown"} — skipping`);
        outputData["ssfEvents"] = [];
        return;
    }

    // Anomalous access: complex subject built inside the transformer.
    if (rawEvent.issue_type == "Anomalous Agent Access") {
        outputData["ssfEvents"] = [];
        let set = transformAnomalousAccessEvent(rawEvent);
        if (set != null) outputData["ssfEvents"].push(set);
        return;
    }

    // Invalid owner: opaque agent subject built inside the transformer.
    if (rawEvent.issue_type == "Agent Invalid Owner") {
        outputData["ssfEvents"] = [];
        let set = transformInvalidOwnerEvent(rawEvent);
        if (set != null) outputData["ssfEvents"].push(set);
        return;
    }

    // --- Generic subject building for remaining VIP issue types ---
    let keys = rawEvent.issue_keys;
    let userSubject = buildUserSubject(keys);
    let agentId     = keys.agent_id;

    // Build subject: complex (user + agent) if both present, otherwise whichever is available.
    let subject;
    if (userSubject && agentId) {
        subject = new ComplexSubject({
            "user":  userSubject,
            "agent": new Subject("opaque", { "id": agentId })
        });
    } else if (agentId) {
        subject = new Subject("opaque", { "id": agentId });
    } else {
        subject = userSubject || new Subject("opaque", { "id": "unknown" });
    }

    // Transform events
    outputData["ssfEvents"] = [];
    let transformedData = null;
    if (rawEvent.issue_type == "Compromised User") {
        transformedData = transformCompromisedUserEvent(subject, rawEvent);
    } else if (rawEvent.issue_type == "Access to Unauthorized Countries") {
        transformedData = transformAccessToUnauthorizedCountriesEvent(subject, rawEvent);
    }

    if (transformedData != null) {
        outputData["ssfEvents"].push(transformedData);
    }
}

main();
