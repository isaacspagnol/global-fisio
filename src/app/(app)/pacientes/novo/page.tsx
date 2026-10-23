import PatientForm from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export default function NewPatientPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader back="/pacientes" title="Novo paciente" />
      <PatientForm />
    </div>
  );
}
