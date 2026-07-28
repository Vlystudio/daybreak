# Security incident and consumer-health breach response

This is an operational plan, not a determination that any notification law applies.

## Identify and contain

Open a restricted incident record; assign incident commander, security lead, privacy/legal lead, communications approver, and provider owners. Preserve timestamped, hashed, access-controlled evidence without copying unnecessary health content. Revoke exposed credentials, rotate keys using the documented overlap process, restrict affected accounts/routes, suspend a provider in its registry, and use the AI emergency-disable switch when relevant.

## Assess

Identify systems, time window, affected data-inventory categories, affected subjects, recipients, encryption/access state, deletion status, and whether consumer health data was acquired without authorization. Assess the FTC Health Breach Notification Rule, state breach laws, Washington and Nevada health-data rules, contractual notifications, and international requirements with counsel. Do not infer a legal conclusion from an automated severity score.

## Notify only after authorization

Software must never automatically issue consumer, regulator, media, or contractual legal notices. Authorized humans approve recipients, content, channel, timing, translations, regulator submissions, and evidence. Record why each notification is required or not required.

## Recover and learn

Validate credential rotation, provider suspension/deletion, RLS, logs, affected jobs, and restored systems. Monitor recurrence, preserve the root-cause timeline, assign remediation owners/dates, update data/processor inventories and policies, and run a blameless post-incident review.

## Contact tree and evidence export

The production contact tree must name the incident commander, security owner, privacy counsel, executive approver, cyber insurer/broker, forensics contact, each critical processor, and regulator/communications counsel. Store it in the protected incident system, not this public repository. Export only incident ID, timestamps, categories, decisions, approvals, evidence hashes, remediation, and notification status; exclude credentials and raw personal/health content.
