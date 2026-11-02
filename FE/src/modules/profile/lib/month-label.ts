/** 'YYYY-MM' → 'MM/YY', the label of a month under the axis of the monthly chart (SCRUM-240). */
export const shortMonth = (month: string) => `${month.slice(5, 7)}/${month.slice(2, 4)}`;

/** 'YYYY-MM' → 'MM/YYYY', the title of the tooltip of a month. */
export const longMonth = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
