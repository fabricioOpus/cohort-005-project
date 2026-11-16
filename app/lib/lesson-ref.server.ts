import { courses, lessons, modules } from "~/db/schema";

// The columns that place a Lesson in its Course, shared by the Saved lists so
// each can resolve its rows in one joined query.
export const lessonRefColumns = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};
