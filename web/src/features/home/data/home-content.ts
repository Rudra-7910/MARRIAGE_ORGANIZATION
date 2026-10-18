import type { IconName } from "../../../components/ui/Icon";

export const features: {
  icon: IconName;
  number: string;
  title: string;
  description: string;
  detail: string;
}[] = [
  {
    icon: "people",
    number: "01",
    title: "Both families. One team.",
    description:
      "From your sibling to your favourite chacha ji, bring everyone into one shared wedding workspace.",
    detail: "Everyone knows what’s happening",
  },
  {
    icon: "calendar",
    number: "02",
    title: "Every function, in place.",
    description:
      "Mehendi, Sangeet, Haldi, Pheras. Keep dates, venues and Google Maps directions together.",
    detail: "Less “kahan pahunchna hai?”",
  },
  {
    icon: "flag",
    number: "03",
    title: "Know what needs you.",
    description:
      "See pending decisions, department updates and overdue work, without another round of calls.",
    detail: "Follow up where it matters",
  },
  {
    icon: "wallet",
    number: "04",
    title: "Expenses, without guesswork.",
    description:
      "Track agreed costs, what you’ve paid and what’s pending. Financial details stay private to organizers.",
    detail: "Simple tracking. Clear balances.",
  },
  {
    icon: "mail",
    number: "05",
    title: "A warmer way to invite.",
    description:
      "Organize guests by family, choose their functions and send your invitation card by email.",
    detail: "No guest accounts. No formalities.",
  },
  {
    icon: "camera",
    number: "06",
    title: "Every moment, together.",
    description:
      "Let guests upload photos with a QR code. Approve favourites for the gallery and share your YouTube livestream.",
    detail: "For the people near and far",
  },
];

export const steps = [
  {
    number: "01",
    title: "Make it your wedding.",
    description:
      "Add your names, wedding date and functions. Start with a ready-made checklist, then make it your own.",
    detail: "One shared starting point",
    icon: "calendar" as IconName,
  },
  {
    number: "02",
    title: "Bring your people in.",
    description:
      "Invite family and department coordinators. Already have a local vendor? Just add their contact.",
    detail: "Family-led or planner-led",
    icon: "people" as IconName,
  },
  {
    number: "03",
    title: "Plan less. Celebrate more.",
    description:
      "Check progress, record vendor updates and see what needs your attention. Everyone stays in the loop.",
    detail: "Fewer follow-ups, every day",
    icon: "circle-check" as IconName,
  },
];

export const questions = [
  {
    question: "Can both families plan the wedding together?",
    answer:
      "Yes. Both families share one wedding workspace. Organizers can invite family members, managers and helpers, with access that matches their role.",
  },
  {
    question: "Do our guests need to sign up?",
    answer:
      "No. Guests open their invitation link to see the functions they’re invited to, venue directions, published updates and the approved photo gallery. No account or RSVP form is required.",
  },
  {
    question: "What if our local vendors don’t use apps?",
    answer:
      "They don’t have to. Add their contact details and record their updates after a phone call or conversation. Organizers can update progress on their behalf.",
  },
  {
    question: "Who can see the budget and expenses?",
    answer:
      "Only wedding organizers can view or edit financial details. Managers, workers and guests cannot see the budget, expenses or pending dues.",
  },
  {
    question: "Can anyone upload photos to the wedding gallery?",
    answer:
      "Guests with the upload QR link can submit photos without an account. Photos appear in the public gallery only after an organizer approves them.",
  },
  {
    question: "Does this replace a wedding planner?",
    answer:
      "It works with the way you plan. A couple, sibling, parent or hired planner can manage the wedding. The workspace helps everyone coordinate; hiring a planner is optional.",
  },
];
