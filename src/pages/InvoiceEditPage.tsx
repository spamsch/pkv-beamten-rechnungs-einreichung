import { useNavigate, useParams } from "react-router-dom";
import {
  usePersons,
  useInvoice,
  useUpdateInvoice,
} from "../hooks/useInvoices";
import { InvoiceForm } from "../components/InvoiceForm";

export function InvoiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoiceId = id ? parseInt(id) : undefined;

  const { data: persons = [] } = usePersons();
  const { data: invoice, isLoading } = useInvoice(invoiceId);
  const updateMutation = useUpdateInvoice();

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-400">Laden...</div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 text-center text-gray-400">
        Rechnung nicht gefunden
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Rechnung #{invoice.id} bearbeiten
      </h2>
      {persons.length > 0 && (
        <InvoiceForm
          persons={persons}
          initial={invoice}
          onSubmit={async (input) => {
            await updateMutation.mutateAsync({ id: invoice.id, input });
            navigate("/invoices");
          }}
          isSubmitting={updateMutation.isPending}
        />
      )}
    </div>
  );
}
