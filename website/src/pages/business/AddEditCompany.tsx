import { useParams } from 'react-router-dom';
import CompanyForm from './CompanyForm';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';

/**
 * Add or edit a company, for a member who already has one.
 *
 * The form itself is `CompanyForm` — the same component `/business/create-profile`
 * renders for a member's first company. This screen is the route and the copy;
 * every question, every option list and the whole save path live in one place.
 * See the header of `CompanyForm.tsx` for why.
 */
const AddEditCompany = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { activeCompany } = useActiveCompanyStore();

  return (
    <CompanyForm
      companyId={id}
      title={isEditMode ? 'Edit Company' : 'Add New Company'}
      subtitle={
        isEditMode
          ? 'Update this company’s details'
          : activeCompany?.publication?.unlimited
            ? 'Included with your ₹2 lakh membership and existing membership ID'
            : 'Save privately; pay this company’s plan when you want others to find it'
      }
      returnTo="/business/companies"
      createLabel="Create Company"
    />
  );
};

export default AddEditCompany;
