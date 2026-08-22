import PatientForm from "@/components/PatientForm";

export default function NewPatientPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Novo paciente</h1>
      <PatientForm />
    </div>
  );
}
