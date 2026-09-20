import { createUI as createExistingUI } from './ui.js';
import { createStudyDesign } from './study-design.js';
import { createCalendarPage } from './calendar-page.js';
import { createDailyOverview } from './daily-overview.js';

// Preserve the existing controller, storage and action handlers. Presentation
// runs after the existing synchronous render, rather than watching all DOM edits.
export function createUI(...args) {
  const ui = createExistingUI(...args);
  const design = createStudyDesign(args[0]);
  const calendarPage = createCalendarPage(args[0]);
  const daily = createDailyOverview(args[0]);
  return {
    ...ui,
    render(...renderArgs) {
      const result = ui.render(...renderArgs);
      design.update(renderArgs[0] || {});
      calendarPage.render(renderArgs[0]);
      daily.render(renderArgs[0]);
      return result;
    },
  };
}
