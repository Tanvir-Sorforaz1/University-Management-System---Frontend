import { ExamDetail } from "@/components/exam-pages";

export default function StudentExamDetailPage() {
  return <ExamDetail canManage={false} role="student" />;
}