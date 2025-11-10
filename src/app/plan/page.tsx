import { StudyPlanReader } from "@/components/plan/study-plan-reader";

export default function StudyPlanPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-8">
         <div className="space-y-2 text-center">
            <h1 className="text-3xl font-headline font-bold">Plan de Estudio Anual</h1>
            <p className="text-muted-foreground">
                Lecturas bíblicas diarias para fortalecer tu fe.
            </p>
        </div>
        <StudyPlanReader />
      </div>
    </div>
  );
}
