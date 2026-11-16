import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const CREATED = new Date("2026-01-01T00:00:00.000Z");
const EDITED = new Date("2026-02-01T00:00:00.000Z");

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let firstLessonId: number;
let secondLessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  firstLessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
  secondLessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 2", position: 2 })
    .returning()
    .get().id;
});

describe("saving a Note", () => {
  it("creates the Student's Note on a Lesson", () => {
    saveNote(
      db,
      base.user.id,
      firstLessonId,
      "Remember the edge case",
      CREATED
    );

    expect(getNote(db, base.user.id, firstLessonId)).toMatchObject({
      body: "Remember the edge case",
      createdAt: CREATED.toISOString(),
      updatedAt: CREATED.toISOString(),
    });
  });

  it("replaces the body of an existing Note and keeps one Note per Lesson", () => {
    saveNote(db, base.user.id, firstLessonId, "First draft", CREATED);
    saveNote(db, base.user.id, firstLessonId, "Second draft", EDITED);

    expect(getNote(db, base.user.id, firstLessonId)).toMatchObject({
      body: "Second draft",
      createdAt: CREATED.toISOString(),
      updatedAt: EDITED.toISOString(),
    });
    expect(db.select().from(schema.notes).all()).toHaveLength(1);
  });

  it("deletes the Note when the body is empty", () => {
    saveNote(db, base.user.id, firstLessonId, "Something", CREATED);
    saveNote(db, base.user.id, firstLessonId, "", EDITED);

    expect(getNote(db, base.user.id, firstLessonId)).toBeUndefined();
  });

  it("keeps one Student's Note out of another Student's reach", () => {
    saveNote(db, base.user.id, firstLessonId, "Mine", CREATED);

    expect(getNote(db, base.instructor.id, firstLessonId)).toBeUndefined();
  });
});

describe("listing a Student's Notes", () => {
  it("returns only the Student's own Notes, most recently edited first", () => {
    saveNote(db, base.user.id, firstLessonId, "Older", CREATED);
    saveNote(db, base.user.id, secondLessonId, "Newer", EDITED);
    saveNote(db, base.instructor.id, firstLessonId, "Not theirs", EDITED);

    expect(listNotesForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        body: "Newer",
        lessonId: secondLessonId,
        lessonTitle: "Lesson 2",
        courseSlug: "test-course",
      }),
      expect.objectContaining({ body: "Older", lessonId: firstLessonId }),
    ]);
  });
});
