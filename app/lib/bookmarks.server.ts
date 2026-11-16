import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { bookmarks, courses, lessons, modules } from "~/db/schema";
import { lessonRefColumns } from "~/lib/lesson-ref.server";

// ─── Bookmarks ───
// A Student's flag on a Lesson. One per Student per Lesson, seen only by the
// Student. See GLOSSARY.md. Every function takes the database first so tests
// can hand in an in-memory one.

export type Db = BetterSQLite3Database<typeof schema>;

function byStudentAndLesson(userId: number, lessonId: number) {
  return and(eq(bookmarks.userId, userId), eq(bookmarks.lessonId, lessonId));
}

export function isBookmarked(db: Db, userId: number, lessonId: number) {
  return !!db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(byStudentAndLesson(userId, lessonId))
    .get();
}

/**
 * Removes the Student's Bookmark on the Lesson if there is one, otherwise adds
 * it. Returns whether the Lesson is bookmarked afterwards. The insert ignores a
 * conflict, so two concurrent toggles cannot trip the unique index.
 */
export function toggleBookmark(db: Db, userId: number, lessonId: number) {
  const removed = db
    .delete(bookmarks)
    .where(byStudentAndLesson(userId, lessonId))
    .returning({ id: bookmarks.id })
    .all();
  if (removed.length > 0) return false;

  db.insert(bookmarks).values({ userId, lessonId }).onConflictDoNothing().run();
  return true;
}

/** The Student's Bookmarks, newest first, each placed in its Course. */
export function listBookmarksForStudent(db: Db, userId: number) {
  return db
    .select({
      id: bookmarks.id,
      createdAt: bookmarks.createdAt,
      ...lessonRefColumns,
    })
    .from(bookmarks)
    .innerJoin(lessons, eq(bookmarks.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.id))
    .all();
}
