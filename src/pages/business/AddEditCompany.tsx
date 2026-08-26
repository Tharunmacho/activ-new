import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Building2, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import BusinessPageShell from './BusinessPageShell';
import { Card, SectionHeading, FieldGrid, Field } from './BusinessUI';
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { BUSINESS_TYPES, normalizeBusinessType } from '@/lib/businessTypes';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';

const AddEditCompany = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const { loadCompanies } = useActiveCompanyStore();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    description: '',
    businessType: '',
    mobileNumber: '',
    email: '',
    area: '',
    location: '',
    logo: ''
  });
  const [logoPreview, setLogoPreview] = useState('');
  /**
   * The chosen file itself, kept alongside the preview.
   *
   * The logo was read with `FileReader` and posted as a base64 string in a JSON
   * `logo` field. `createBusinessProfile` / `updateBusinessProfileById` take the
   * logo from `req.file` — multer, multipart — and never destructure `logo`
   * from the body, so that string was dropped on the floor. The request still
   * answered `success: true` (everything *else* in it saved), the toast said
   * "Company updated successfully", and the logo silently never changed. Mobile
   * has always sent multipart; so does this now.
   */
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (isEditMode) {
      fetchCompanyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCompanyData = async () => {
    try {
      const response = await apiFetch(`/business-profiles/${id}`);
      const result = await response.json();

      if (result.success) {
        setFormData({
          businessName: result.data.businessName || '',
          description: result.data.description || '',
          // A row written before the lists were reconciled can hold a value
          // this select no longer offers; '' makes the user pick a valid one
          // rather than showing a blank that silently saves the old value.
          businessType: normalizeBusinessType(result.data.businessType),
          mobileNumber: result.data.mobileNumber || '',
          email: result.data.email || '',
          area: result.data.area || '',
          location: result.data.location || '',
          logo: result.data.logo || ''
        });
        if (result.data.logo) {
          setLogoPreview(result.data.logo);
        }
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to fetch company data');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        toast.error('Please upload an image smaller than 2MB');
        return;
      }

      // The file is what gets uploaded; the data URL is only for the preview
      // beside the picker, and is deliberately NOT put into formData.logo.
      setLogoFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    if (!formData.businessType) {
      toast.error('Business type is required');
      return;
    }
    if (!formData.mobileNumber.trim()) {
      toast.error('Mobile number is required');
      return;
    }
    if (!formData.location.trim()) {
      toast.error('City / location is required');
      return;
    }

    setLoading(true);

    try {
      const url = isEditMode ? `/business-profiles/${id}` : '/business-profiles';
      const method = isEditMode ? 'PUT' : 'POST';

      /**
       * Multipart when a new logo was picked, JSON otherwise.
       *
       * `apiFetch` drops its own Content-Type for a FormData body so the
       * browser can set the multipart boundary; setting it by hand here would
       * produce a body multer cannot parse.
       */
      let body: BodyInit;
      if (logoFile) {
        const payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          // `logo` is carried by the file part, not as a text field.
          if (key === 'logo') return;
          payload.append(key, String(value ?? ''));
        });
        payload.append('logo', logoFile);
        body = payload;
      } else {
        body = JSON.stringify(formData);
      }

      const response = await apiFetch(url, { method, body });
      const result = await response.json();

      if (result.success) {
        toast.success(isEditMode ? 'Company updated successfully' : 'Company created successfully');
        // Every screen reads the shared selection; refresh it so the new name
        // and logo reach the sidebar without a reload.
        await loadCompanies({ force: true });
        navigate('/business/companies');
      } else {
        toast.error(result.message || `Failed to ${isEditMode ? 'update' : 'create'} company`);
      }
    } catch (error) {
      console.error('Error saving company:', error);
      toast.error(`An error occurred while ${isEditMode ? 'updating' : 'creating'} the company`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BusinessPageShell
      title={isEditMode ? 'Edit Company' : 'Add New Company'}
      subtitle={isEditMode ? formData.businessName : 'Register another business under your membership'}
      width="standard"
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => navigate('/business/companies')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
          <Button
            type="submit"
            form="company-form"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Saving…' : isEditMode ? 'Update Company' : 'Create Company'}
          </Button>
        </>
      }
    >
      {/*
          Three columns from lg up: identity on the left, details on the right.

          The form was a single `space-y-6` column of six full-width fields
          inside an `max-w-4xl` card, so a ten-digit mobile number sat in an
          850px-wide input while the page still scrolled.
      */}
      <form id="company-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:sticky lg:top-0">
            <SectionHeading title="Company Identity" icon={Building2} />

            <label
              htmlFor="company-logo"
              className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500
                         transition-colors cursor-pointer overflow-hidden bg-slate-50"
            >
              {/* A stored `/uploads/...` path belongs to the API origin, not to
                  this site; a freshly picked file is a data: URL and is returned
                  untouched. */}
              {logoPreview ? (
                <img
                  src={resolveMediaUrl(logoPreview)}
                  alt="Logo preview"
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
                  <Upload className="h-9 w-9 text-slate-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Upload Company Logo</p>
                  <p className="text-xs text-slate-500 mt-1">JPG or PNG, max 2MB</p>
                </div>
              )}
            </label>
            <input
              id="company-logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            {logoPreview ? (
              <p className="text-xs text-slate-500 mt-2 text-center">Click the image to change it</p>
            ) : null}
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <SectionHeading title="Business Details" icon={Building2} />
              <FieldGrid>
                <Field label="Business Name" required>
                  <Input
                    name="businessName"
                    placeholder="Enter business name"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Business Type" required>
                  <Select
                    value={formData.businessType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, businessType: value }))}
                  >
                    <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                      <SelectValue placeholder="Select a business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Description" full>
                  <Textarea
                    name="description"
                    placeholder="Describe your company offerings…"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="min-h-[120px] border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>
              </FieldGrid>
            </Card>

            <Card>
              <SectionHeading title="Contact &amp; Location" icon={Phone} />
              <FieldGrid>
                <Field label="Mobile Number" required>
                  <Input
                    name="mobileNumber"
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Email Address">
                  <Input
                    name="email"
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="City / Location" required>
                  <Input
                    name="location"
                    placeholder="City, State"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>

                <Field label="Area / Locality">
                  <Input
                    name="area"
                    placeholder="e.g. Guindy Industrial Estate"
                    value={formData.area}
                    onChange={handleInputChange}
                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                  />
                </Field>
              </FieldGrid>
            </Card>

            {/* Actions repeat at the foot of a long form, right-aligned rather
                than two full-bleed buttons filling the card. */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-50"
                onClick={() => navigate('/business/companies')}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
                <MapPin className="h-4 w-4 mr-2" />
                {loading ? 'Saving…' : isEditMode ? 'Update Company' : 'Create Company'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </BusinessPageShell>
  );
};

export default AddEditCompany;
