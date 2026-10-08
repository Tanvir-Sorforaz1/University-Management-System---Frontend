import { FacultyExamResults } from "@/components/result-pages";

export default async function FacultyExamResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  return <FacultyExamResults examId={examId} />;
}