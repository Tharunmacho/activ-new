import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ImagePlus, Package, IndianRupee, Store } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, FieldGrid, Field, companyName } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

const AddProduct = () => {
    const navigate = useNavigate();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { activeCompany, loadCompanies } = useActiveCompanyStore();

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        image: null as File | null,
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }

            setFormData({ ...formData, image: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.price) {
            toast.error("Please fill in all required fields");
            return;
        }

        const priceNum = parseFloat(formData.price);
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error("Please enter a valid price");
            return;
        }

        /* No stock check: the field came off this form, so there is no
           number to validate and a guard on one refuses a save nobody
           can satisfy. */

        setLoading(true);

        try {
            /**
             * Field names as the API actually reads them.
             *
             * Three of these were wrong and all three failed silently, because
             * an unknown key in a JSON body is simply ignored:
             *   `productName`   -> `name`     (accepted on write, but the
             *                                  response only ever has `name`,
             *                                  so every list showed a blank)
             *   `stockQuantity` -> `stock`    (every product saved with 0)
             *   `productImage`  -> `imageUrl` (the image was dropped)
             *
             * `companyId` is likewise required: without it `createProduct`
             * falls back to "the member's latest company", so a product added
             * while working on an older company landed in the newest catalog.
             *
             * The image goes as a multipart file part named `image`, which is
             * what `product.routes.js` reads (`upload.single('image')`) and what
             * mobile has always sent. This used to pass `imageUrl: imagePreview`
             * — the base64 data URL — in a JSON body. The controller does accept
             * a body `imageUrl`, so it "worked", at the cost of storing a whole
             * image inside the product document instead of on disk under
             * /uploads, where every other image on the platform lives.
             */
            const payload = new FormData();
            if (activeCompany?._id) payload.append('companyId', activeCompany._id);
            payload.append('name', formData.name.trim());
            payload.append('description', formData.description.trim());
            payload.append('price', String(priceNum));
            if (formData.image) payload.append('image', formData.image);

            // `apiFetch` drops its own Content-Type for FormData so the browser
            // can set the multipart boundary.
            const response = await apiFetch('/products', { method: 'POST', body: payload });
            const result = await response.json();

            if (result.success) {
                toast.success('Product added successfully!');
                navigate('/business/products');
            } else {
                toast.error(result.message || 'Failed to add product');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            toast.error('An error occurred while adding the product');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BusinessPageShell
            title="Add Product / Service"
            subtitle={activeCompany ? `Adding to ${companyName(activeCompany)}` : 'No active company selected'}
            width="standard"
            actions={
                <>
                    <Button
                        variant="outline"
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate("/business/products")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Cancel</span>
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? 'Publishing…' : 'Publish Product'}
                    </Button>
                </>
            }
        >
            {/*
                One column on a phone, three from lg up.

                This was an unconditional `grid grid-cols-3`, with no responsive
                prefix at all — so a 375px screen got a ~110px image dropzone that
                still carried `min-h-[18.75rem]`, beside two columns of fields.
            */}
            {/*
                ONE CARD, one column, four fields.

                This was a three-card grid — media, details, pricing — with a
                sticky rail on the left, for a picture, a name, a description
                and a price. The furniture was the bulk of the screen. A single
                form reads as the small task it is, and the picture sits beside
                the fields rather than in a card of its own.
            */}
            <div className="mx-auto w-full max-w-4xl">
                <Card>
                    <SectionHeading title="Product" icon={Package} />

                    <div className="grid gap-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] items-start">
                        <div>
                            <label
                                htmlFor="product-image"
                                className="block rounded-xl border-2 border-dashed border-slate-300
                                           hover:border-blue-500 transition-colors cursor-pointer
                                           overflow-hidden bg-slate-50"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Product preview"
                                        className="w-full h-52 object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-52 px-4 text-center">
                                        <ImagePlus className="h-9 w-9 text-slate-400 mb-2.5" />
                                        <p className="text-[1.25rem] font-semibold text-slate-700">Add a picture</p>
                                        <p className="text-[1.1875rem] text-slate-500 mt-1">JPG or PNG, max 5MB</p>
                                    </div>
                                )}
                            </label>
                            <input
                                id="product-image"
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            {imagePreview ? (
                                <p className="text-[1.1875rem] text-slate-500 mt-2 text-center">
                                    Click the image to change it
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-5">
                            <Field label="Product Name" required full>
                                <Input
                                    placeholder="Enter product / service name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Price (₹)" required full>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Description" full>
                                <Textarea
                                    placeholder="Describe your product features & specifications…"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[7.5rem] border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            {/*
                                NO CATEGORY AND NO SKU. The company answered
                                "what do you make" once, on its own profile,
                                against NIC — a better classification than a
                                nine-item list, and the one the directory
                                searches. The server still generates a SKU and
                                stores a category, so nothing downstream loses a
                                field.
                            */}
                        </div>
                    </div>
                </Card>

                <div className="mt-6">
                    {!activeCompany && (
                        <Card className="border-amber-200 bg-amber-50">
                            <div className="flex items-start gap-3">
                                <Store className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[1.25rem] text-amber-800">
                                    No active company is selected, so this product would be filed
                                    against whichever company the server considers latest. Pick one
                                    from My Companies first.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </BusinessPageShell>
    );
};

export default AddProduct;
