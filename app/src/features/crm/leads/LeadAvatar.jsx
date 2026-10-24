import { useState } from "react";
import { initials } from '../../../services/crmSync';

export default function LeadAvatar({ lead, className = "", style }) {
  const [hasError, setHasError] = useState(false);
  const shouldShowImage = Boolean(lead?.photo) && !hasError;

  return (
    <span
      className={`lead-avatar${className ? ` ${className}` : ""}`}
      style={{
        ...style,
        backgroundColor: lead?.avatarColor ?? "#2F6FED",
      }}
    >
      {shouldShowImage ? (
        <img src={lead.photo} alt={lead.name} onError={() => setHasError(true)} />
      ) : (
        <span>{initials(lead?.name ?? "Lead")}</span>
      )}
    </span>
  );
}
