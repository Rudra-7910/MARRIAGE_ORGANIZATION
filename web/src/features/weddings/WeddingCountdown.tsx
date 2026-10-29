import { useEffect, useState } from "react";
import { weddingCountdown } from "../../lib/weddings";
import { Icon } from "../../components/ui/Icon";

export function WeddingCountdown({
  date,
  time,
  detailsHref,
}: {
  date: string;
  time: string;
  detailsHref?: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    function syncCountdown() {
      if (timer) clearInterval(timer);
      setNow(Date.now());
      if (!document.hidden && weddingCountdown(date, time)?.started === false) {
        timer = setInterval(() => {
          const current = Date.now();
          setNow(current);
          if (weddingCountdown(date, time, current)?.started) clearInterval(timer);
        }, 1000);
      }
    }
    syncCountdown();
    document.addEventListener("visibilitychange", syncCountdown);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", syncCountdown);
    };
  }, [date, time]);
  const remaining = weddingCountdown(date, time, now);
  if (!remaining) return null;
  return (
    <section
      className="wedding-countdown"
      aria-label="Countdown to the saved wedding ceremony time"
    >
      <div className="wedding-countdown-copy">
        <span className="wedding-countdown-eyebrow">
          <Icon name="spark" /> THE BEAUTIFUL WAIT
        </span>
        <p className="wedding-countdown-heading" lang="hi">
          {remaining.started ? "शुभ मुहूर्त आ गया है" : "शुभ मुहूर्त तक"}
        </p>
        <p>
          {remaining.started
            ? "Wishing you a beautiful new beginning."
            : "Counting down to the wedding."}
        </p>
        {detailsHref && (
          <a href={detailsHref}>
            Ceremony details <Icon name="arrow" />
          </a>
        )}
      </div>
      <div className="wedding-countdown-remaining">
        {!remaining.started ? (
          <div
            className="wedding-countdown-digits"
            role="timer"
            aria-live="off"
            aria-label={
              remaining.days +
              " days, " +
              remaining.hours +
              " hours, " +
              remaining.minutes +
              " minutes, " +
              remaining.seconds +
              " seconds until the wedding"
            }
          >
            {[
              { label: "Days", value: remaining.days },
              { label: "Hours", value: remaining.hours },
              { label: "Minutes", value: remaining.minutes },
              { label: "Seconds", value: remaining.seconds },
            ].map((part) => (
              <div
                key={part.label}
                className={"wedding-countdown-unit " + part.label.toLowerCase()}
              >
                <strong>
                  <span key={part.value} className="wedding-countdown-value">
                    {String(part.value).padStart(2, "0")}
                  </span>
                </strong>
                <span>{part.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="wedding-countdown-blessing" lang="hi">
            <Icon name="circle-check" />
            नवजीवन की मंगलकामनाएँ।
          </p>
        )}
      </div>
    </section>
  );
}
