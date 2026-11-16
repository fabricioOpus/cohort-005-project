import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import {
  isBookmarked,
  listBookmarksForStudent,
  toggleBookmark,
} from "./bookmarks.server";

type TestDb = ReturnType<typeof createTestDb>;

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

describe("toggling a Bookmark", () => {
  it("bookmarks a Lesson the Student had not bookmarked", () => {
    expect(toggleBookmark(db, base.user.id, firstLessonId)).toBe(true);
    expect(isBookmarked(db, base.user.id, firstLessonId)).toBe(true);
  });

  it("removes the Bookmark when toggled a second time", () => {
    toggleBookmark(db, base.user.id, firstLessonId);

    expect(toggleBookmark(db, base.user.id, firstLessonId)).toBe(false);
    expect(isBookmarked(db, base.user.id, firstLessonId)).toBe(false);
  });

  it("keeps one Student's Bookmark invisible to another", () => {
    toggleBookmark(db, base.user.id, firstLessonId);

    expect(isBookmarked(db, base.instructor.id, firstLessonId)).toBe(false);
  });
});

describe("listing a Student's Bookmarks", () => {
  it("returns only the Student's own Bookmarks, newest first, with the Lesson's place", () => {
    db.insert(schema.bookmarks)
      .values([
        {
          userId: base.user.id,
          lessonId: firstLessonId,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          userId: base.user.id,
          lessonId: secondLessonId,
          createdAt: "2026-02-01T00:00:00.000Z",
        },
        { userId: base.instructor.id, lessonId: firstLessonId },
      ])
      .run();

    expect(listBookmarksForStudent(db, base.user.id)).toEqual([
      expect.objectContaining({
        lessonId: secondLessonId,
        lessonTitle: "Lesson 2",
        moduleTitle: "Basics",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      }),
      expect.objectContaining({ lessonId: firstLessonId }),
    ]);
  });
});
