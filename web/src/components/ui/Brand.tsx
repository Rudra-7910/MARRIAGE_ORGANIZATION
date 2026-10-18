import { Link } from "react-router-dom";

export function Brand() {
  return (
    <Link to="/#top" className="brand" aria-label="Make My Marriage home">
      <span className="brand-mark" aria-hidden="true">
        M<span>3</span>
      </span>
      <span className="brand-name">
        Make My Marriage
        <span className="brand-caption">A little more together.</span>
      </span>
    </Link>
  );
}
