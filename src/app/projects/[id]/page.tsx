import { ProjectDetail } from "@/components/project-detail";

type Params = { params: Promise<{ id: string }> };

export default async function ProjectPage({ params }: Params) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
