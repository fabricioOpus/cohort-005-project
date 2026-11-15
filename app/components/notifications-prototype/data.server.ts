// PROTOTYPE — throwaway. Ticket "Como as notificações aparecem dentro do app" (#18).
// Fakes Notifications from real seed rows (Comments and Lessons) so the variants
// render against realistic data. No notifications table exists yet; read/unread
// is invented here (newest UNREAD_COUNT are unread) and toggled in memory only.
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "~/db";
import {
  comments,
  courses,
  enrollments,
  lessons,
  modules,
  users,
} from "~/db/schema";

export type ProtoNotificationType = "new_comment" | "reply" | "new_lesson";

export type ProtoNotification = {
  id: string;
  type: ProtoNotificationType;
  actorName: string | null;
  courseTitle: string;
  courseSlug: string;
  lessonId: number;
  lessonTitle: string;
  // The thread a notification belongs to (top-level Comment id), for grouping.
  threadId: number | null;
  excerpt: string | null;
  createdAt: string;
  read: boolean;
};

const UNREAD_COUNT = 5;
const LIMIT = 15;

function excerpt(body: string) {
  return body.length > 90 ? `${body.slice(0, 90)}…` : body;
}

function commentNotifications(userId: number): ProtoNotification[] {
  const author = alias(users, "author");
  const parent = alias(comments, "parent");

  const rows = db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      parentUserId: parent.userId,
      body: comments.body,
      createdAt: comments.createdAt,
      authorName: author.name,
      instructorId: courses.instructorId,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(author, eq(author.id, comments.userId))
    .leftJoin(parent, eq(parent.id, comments.parentId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, modules.courseId))
    .where(and(isNull(comments.deletedAt), ne(comments.userId, userId)))
    .orderBy(desc(comments.createdAt))
    .limit(200)
    .all();

  return rows.flatMap((r): ProtoNotification[] => {
    // One Notification per person per event; reply wins over new_comment.
    const isReplyToMe = r.parentUserId === userId;
    const isMyCourse = r.instructorId === userId;
    if (!isReplyToMe && !isMyCourse) return [];
    return [
      {
        id: `c${r.id}`,
        type: isReplyToMe ? "reply" : "new_comment",
        actorName: r.authorName,
        courseTitle: r.courseTitle,
        courseSlug: r.courseSlug,
        lessonId: r.lessonId,
        lessonTitle: r.lessonTitle,
        threadId: r.parentId ?? r.id,
        excerpt: excerpt(r.body),
        createdAt: r.createdAt,
        read: false,
      },
    ];
  });
}

function lessonNotifications(userId: number): ProtoNotification[] {
  return db
    .select({
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      createdAt: lessons.createdAt,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(modules, eq(modules.courseId, courses.id))
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(lessons.createdAt), desc(lessons.id))
    .limit(6)
    .all()
    .map((r) => ({
      id: `l${r.lessonId}`,
      type: "new_lesson" as const,
      actorName: null,
      courseTitle: r.courseTitle,
      courseSlug: r.courseSlug,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      threadId: null,
      excerpt: null,
      createdAt: r.createdAt,
      read: false,
    }));
}

export function getPrototypeNotifications(
  userId: number | null
): ProtoNotification[] {
  if (userId === null) return [];
  return [...commentNotifications(userId), ...lessonNotifications(userId)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIMIT)
    .map((n, i) => ({ ...n, read: i >= UNREAD_COUNT }));
}
