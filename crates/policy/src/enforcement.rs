use lah_core::error::{AppError, AppResult};
use lah_core::types::{DataClassification, UserRole};

/// Central policy enforcement engine.
///
/// Evaluates whether an action is permitted based on:
/// - User role and capabilities
/// - Data classification
/// - Feature flags / tenant config
/// - Whether approval is required
pub struct PolicyEngine;

/// An action the user wants to perform.
#[derive(Debug, Clone)]
pub struct PolicyAction {
    pub action: String,
    pub resource_type: String,
    pub classification: DataClassification,
    pub user_role: UserRole,
    pub tenant_id: String,
}

/// Result of policy evaluation.
#[derive(Debug, Clone)]
pub enum PolicyDecision {
    /// Action is allowed immediately.
    Allow,
    /// Action is allowed but requires explicit user confirmation.
    AllowWithConfirmation { reason: String },
    /// Action requires approval from an admin.
    RequiresApproval { reason: String },
    /// Action is denied outright.
    Deny { reason: String },
}

impl PolicyEngine {
    /// Evaluate whether an action is permitted.
    pub fn evaluate(action: &PolicyAction) -> PolicyDecision {
        // 1. Check hard denials first

        // RESTRICTED data can NEVER be sent to AI
        if action.action == "send_to_ai"
            && action.classification == DataClassification::Restricted
        {
            return PolicyDecision::Deny {
                reason: "RESTRICTED data cannot be sent to AI providers".into(),
            };
        }

        // Viewers cannot modify anything
        if action.user_role == UserRole::Viewer
            && matches!(
                action.action.as_str(),
                "upload" | "delete" | "modify" | "connect_integration" | "rotate_keys"
            )
        {
            return PolicyDecision::Deny {
                reason: "Viewer role cannot perform write operations".into(),
            };
        }

        // 2. Check actions requiring approval

        // Destructive actions always require approval if workflow is enabled
        if matches!(
            action.action.as_str(),
            "delete_all_files"
                | "rotate_master_key"
                | "revoke_all_tokens"
                | "export_all_data"
                | "disable_legal_hold"
        ) {
            return PolicyDecision::RequiresApproval {
                reason: format!(
                    "Action '{}' is destructive and requires admin approval",
                    action.action
                ),
            };
        }

        // 3. Check actions requiring confirmation

        // CONFIDENTIAL data to AI requires explicit confirmation
        if action.action == "send_to_ai"
            && action.classification == DataClassification::Confidential
        {
            return PolicyDecision::AllowWithConfirmation {
                reason: "CONFIDENTIAL data will be sent to an external AI provider. Confirm?".into(),
            };
        }

        // Connecting integrations with write access
        if action.action == "connect_github_write" {
            return PolicyDecision::AllowWithConfirmation {
                reason: "GitHub write access allows creating issues and PRs. Confirm?".into(),
            };
        }

        // Deleting individual files
        if action.action == "delete" && action.classification >= DataClassification::Confidential {
            return PolicyDecision::AllowWithConfirmation {
                reason: format!(
                    "Deleting {} file requires confirmation",
                    action.classification
                ),
            };
        }

        // 4. Role-based checks
        match (&action.user_role, action.action.as_str()) {
            (UserRole::Conductor, "connect_integration") => PolicyDecision::Deny {
                reason: "Conductors cannot manage integrations".into(),
            },
            (UserRole::Conductor, "manage_users") => PolicyDecision::Deny {
                reason: "Conductors cannot manage users".into(),
            },
            (UserRole::Operator, "manage_users") => PolicyDecision::RequiresApproval {
                reason: "User management requires admin approval".into(),
            },
            _ => PolicyDecision::Allow,
        }
    }

    /// Quick check: is the action allowed (Allow or AllowWithConfirmation)?
    pub fn is_permitted(action: &PolicyAction) -> bool {
        matches!(
            Self::evaluate(action),
            PolicyDecision::Allow | PolicyDecision::AllowWithConfirmation { .. }
        )
    }

    /// Convert a PolicyDecision to an AppResult.
    pub fn enforce(action: &PolicyAction) -> AppResult<PolicyDecision> {
        let decision = Self::evaluate(action);
        match &decision {
            PolicyDecision::Deny { reason } => Err(AppError::PolicyDenied {
                action: action.action.clone(),
                reason: reason.clone(),
            }),
            PolicyDecision::RequiresApproval { .. } => Err(AppError::ApprovalRequired {
                action: action.action.clone(),
            }),
            _ => Ok(decision),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_restricted_data_denied_for_ai() {
        let action = PolicyAction {
            action: "send_to_ai".into(),
            resource_type: "file".into(),
            classification: DataClassification::Restricted,
            user_role: UserRole::Admin,
            tenant_id: "t1".into(),
        };
        assert!(matches!(PolicyEngine::evaluate(&action), PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_confidential_data_requires_confirmation_for_ai() {
        let action = PolicyAction {
            action: "send_to_ai".into(),
            resource_type: "file".into(),
            classification: DataClassification::Confidential,
            user_role: UserRole::Admin,
            tenant_id: "t1".into(),
        };
        assert!(matches!(
            PolicyEngine::evaluate(&action),
            PolicyDecision::AllowWithConfirmation { .. }
        ));
    }

    #[test]
    fn test_viewer_cannot_upload() {
        let action = PolicyAction {
            action: "upload".into(),
            resource_type: "file".into(),
            classification: DataClassification::Internal,
            user_role: UserRole::Viewer,
            tenant_id: "t1".into(),
        };
        assert!(matches!(PolicyEngine::evaluate(&action), PolicyDecision::Deny { .. }));
    }

    #[test]
    fn test_normal_upload_allowed() {
        let action = PolicyAction {
            action: "upload".into(),
            resource_type: "file".into(),
            classification: DataClassification::Internal,
            user_role: UserRole::Operator,
            tenant_id: "t1".into(),
        };
        assert!(matches!(PolicyEngine::evaluate(&action), PolicyDecision::Allow));
    }
}
