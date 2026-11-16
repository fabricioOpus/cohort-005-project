import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, desc, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { courses, lessons, modules, notes } from "~/db/schema";
import { lessonRefColumns } from "~/lib/lesson-ref.server";

// ─── Notes ───
// A Student's own plain-text writing about a Lesson, private to that Student.
// One per Student per Lesson. See GLOSSARY.md. Every function takes the
// database first so tests can hand in an in-memory one.

export type Db = BetterSQLite3Database<typeof schema>;

function byStudentAndLesson(userId: number, lessonId: number) {
  return and(eq(notes.userId, userId), eq(notes.lessonId, lessonId));
}

export function getNote(db: Db, userId: number, lessonId: number) {
  return db
    .select()
    .from(notes)
    .where(byStudentAndLesson(userId, lessonId))
    .get();
}

/**
 * Writes the Student's Note on the Lesson, creating it or replacing its body.
 * An empty body deletes the Note outright. The caller validates the length.
 */
export function saveNote(
  db: Db,
  userId: number,
  lessonId: number,
  body: string,
  now: Date
) {
  if (body.length === 0) {
    db.delete(notes).where(byStudentAndLesson(userId, lessonId)).run();
    return;
  }

  const timestamp = now.toISOString();
  db.insert(notes)
    .values({
      userId,
      lessonId,
      body,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [notes.userId, notes.lessonId],
      set: { body, updatedAt: timestamp },
    })
    .run();
}

/** The Student's Notes, most recently edited first, each placed in its Course. */
export function listNotesForStudent(db: Db, userId: number) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      updatedAt: notes.updatedAt,
      ...lessonRefColumns,
    })
    .from(notes)
    .innerJoin(lessons, eq(notes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt), desc(notes.id))
    .all();
}
