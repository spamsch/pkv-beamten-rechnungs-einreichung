import { useNavigate } from "react-router-dom";
import { usePersons, useCreateInvoice } from "../hooks/useInvoices";
import { InvoiceForm } from "../components/InvoiceForm";

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const { data: persons = [] } = usePersons();
  const createMutation = useCreateInvoice();

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Neue Rechnung</h2>
      {persons.length > 0 && (
        <InvoiceForm
          persons={persons}
          onSubmit={async (input) => {
            await createMutation.mutateAsync(input);
            navigate("/invoices");
          }}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  );
}
