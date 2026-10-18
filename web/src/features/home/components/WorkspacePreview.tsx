import { useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import type { IconName } from "../../../components/ui/Icon";

const attentionItems = [
  {
    department: "Catering",
    label: "A small menu decision.",
    note: "Finalize the chaat counter for Sangeet.",
    contact: "Sharma Caterers",
    time: "Today",
    detail:
      "Sample note: the dinner menu is ready. The family needs to confirm whether to include a live chaat counter before the final preparation begins.",
  },
  {
    department: "Decoration",
    label: "The stage is almost set.",
    note: "Confirm the Sangeet floral layout.",
    contact: "Gulab Decor",
    time: "Pending",
    detail:
      "Sample note: Gulab Decor has shared the stage layout. The family can review the flower colours and record a confirmation in the department notes.",
  },
  {
    department: "Lighting",
    label: "Time for a quick check-in.",
    note: "No progress update for 6 days.",
    contact: "Mohan Lighting",
    time: "Update needed",
    detail:
      "Sample note: the lighting department has not posted a progress update for six days. An organizer can contact the team and record its latest progress.",
  },
];

const departments: {
  icon: IconName;
  name: string;
  description: string;
  status: string;
  tone: string;
  update: string;
  attention: boolean;
}[] = [
  {
    icon: "food",
    name: "Catering & sweets",
    description: "Sharma Caterers · Menu confirmation",
    status: "In progress",
    tone: "amber",
    update: "Today, 10:15 AM",
    attention: true,
  },
  {
    icon: "tent",
    name: "Mandap & seating",
    description: "Raj Tent House · Setup checklist",
    status: "To do",
    tone: "red",
    update: "Yesterday, 4:00 PM",
    attention: false,
  },
  {
    icon: "camera",
    name: "Photography",
    description: "Pal Pal Photography · Schedule shared",
    status: "Done",
    tone: "green",
    update: "Today, 9:30 AM",
    attention: false,
  },
];

export function WorkspacePreview() {
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const visibleDepartments = attentionOnly
    ? departments.filter((department) => department.attention)
    : departments;

  return (
    <div
      id="sample-workspace"
      className="workspace-preview"
      aria-label="Interactive sample wedding workspace"
    >
      <div className="preview-header">
        <div className="flex items-center gap-3">
          <span className="couple-avatar">
            a<span>&</span>n
          </span>
          <div>
            <h2>Aditi & Nikhil’s wedding</h2>
            <p>
              <Icon name="pin" />
              Jaipur<span className="preview-date">· 14 February 2027</span>
            </p>
          </div>
        </div>
        <span className="sample-pill">
          <span className="status-dot" />
          Sample workspace
        </span>
      </div>
      <div className="preview-content">
        <div className="preview-section-label">
          <span>
            <Icon name="flag" />
            NEEDS YOUR ATTENTION
          </span>
          <span>3 little things to move forward</span>
        </div>
        <div className="attention-grid">
          {attentionItems.map((item, index) => (
            <article
              className={`attention-card ${index === 2 ? "attention-card-alert" : ""}`}
              key={item.department}
            >
              <div className="attention-meta">
                <span>{item.department}</span>
                <span>{item.time}</span>
              </div>
              <h3>{item.label}</h3>
              <p>{item.note}</p>
              <div className="attention-bottom">
                <span>{item.contact}</span>
                <button
                  aria-expanded={activeNote === index}
                  aria-controls="sample-note"
                  onClick={() =>
                    setActiveNote(activeNote === index ? null : index)
                  }
                >
                  {activeNote === index ? "Close note" : "View note"}
                  <Icon name={activeNote === index ? "close" : "arrow"} />
                </button>
              </div>
            </article>
          ))}
        </div>
        {activeNote !== null && (
          <div className="sample-note" id="sample-note" role="status">
            <Icon name="message" />
            <p>{attentionItems[activeNote].detail}</p>
            <button
              aria-label="Close sample note"
              onClick={() => setActiveNote(null)}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="departments-heading">
          <h3>Everyone’s moving things along.</h3>
          <button
            className={
              attentionOnly ? "filter-button is-active" : "filter-button"
            }
            onClick={() => setAttentionOnly(!attentionOnly)}
            aria-pressed={attentionOnly}
          >
            <Icon name="flag" />
            {attentionOnly ? "Show all departments" : "Needs attention"}
          </button>
        </div>
        <div className="department-list">
          {visibleDepartments.map((department) => (
            <div className="department-row" key={department.name}>
              <span className="department-icon">
                <Icon name={department.icon} />
              </span>
              <div className="department-description">
                <h4>{department.name}</h4>
                <p>{department.description}</p>
              </div>
              <span className={`work-status status-${department.tone}`}>
                <span className="status-dot" />
                {department.status}
              </span>
              <span className="department-update">{department.update}</span>
            </div>
          ))}
        </div>
        <div className="preview-finance">
          <div className="finance-label">
            <Icon name="lock" />
            <div>
              <span>YOUR EXPENSES, IN ONE PLACE</span>
              <small>Visible only to wedding organizers</small>
            </div>
          </div>
          <div className="finance-amounts">
            <div>
              <span>Agreed cost</span>
              <strong>₹7,20,000</strong>
            </div>
            <div>
              <span>Paid</span>
              <strong>₹3,00,000</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>₹4,20,000</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="preview-caption">
        <Icon name="eye" />A little peek at your planning space. All names and
        figures shown are sample data.
      </div>
    </div>
  );
}
