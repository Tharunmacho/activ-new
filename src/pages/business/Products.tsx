import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Package, Pencil, Trash2, Search, Grid3x3, List, Store } from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, EmptyState, Loading } from "./BusinessUI";
import { toast } from "sonner";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

const Products = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");

    const { activeCompany, hasLoaded, loadCompanies } = useActiveCompanyStore();

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useEffect(() => {
        if (!hasLoaded) return;
        loadProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasLoaded, activeCompany?._id]);

    /**
     * The catalog of the company being acted as — not of every company.
     *
     * This asked for `/products` with no `companyId`, and the endpoint answers
     * with every product the member owns across all their companies. A member
     * with two companies saw one merged catalog and switching company changed
     * nothing on this page. The mobile Products screen has always passed
     * `companyId`; the endpoint has always accepted it.
     */
    const loadProducts = async () => {
        const companyId = activeCompany?._id;

        if (!companyId) {
            setProducts([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await apiFetch(`/products?companyId=${encodeURIComponent(companyId)}`);
            const result = await response.json();

            if (result.success) {
                // Belt and braces, as on mobile: never render a product whose
                // owner is not the company on screen, whatever the server sent.
                const list = Array.isArray(result.data) ? result.data : [];
                setProducts(list.filter((item: any) => {
                    const owner = typeof item?.companyId === 'object'
                        ? item?.companyId?._id
                        : item?.companyId;
                    return !owner || String(owner) === String(companyId);
                }));
            }
        } catch (error) {
            console.error('Error loading products:', error);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await apiFetch(`/products/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (result.success) {
                toast.success('Product deleted successfully');
                loadProducts();
            } else {
                toast.error(result.message || 'Failed to delete product');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            toast.error('Failed to delete product');
        }
    };

    /**
     * The product name field is `name`, not `productName`.
     *
     * `productName` does not exist on the Product document (see
     * `backend/src/models/Product.js`), so this read `undefined` for every
     * product and `.toLowerCase()` on it threw — which is why this page
     * rendered blank the moment the catalog was not empty. `category` is
     * required by the schema but is guarded too: a filter must not be the thing
     * that takes down the page.
     */
    const query = (searchQuery || '').toLowerCase();
    const filteredProducts = products.filter(product =>
        (product?.name || '').toLowerCase().includes(query) ||
        (product?.category || '').toLowerCase().includes(query)
    );

    const stockTone = (stock: number) =>
        stock > 10 ? 'text-green-600' : stock > 0 ? 'text-amber-600' : 'text-red-600';

    return (
        <BusinessPageShell
            title="Products & Services"
            subtitle={loading ? 'Loading…' : `${products.length} items in your catalog`}
            width="wide"
            actions={
                <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate("/business/add-product")}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                </Button>
            }
        >
            <div className="space-y-6">
                {/*
                    Active catalog banner and toolbar in one row.

                    The banner used to sit OUTSIDE the `max-w-7xl mx-auto` wrapper
                    that held the grid below it, so on a wide screen the two were
                    visibly misaligned — the banner ran full-bleed while the
                    products were centred and narrower.
                */}
                <Card className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {activeCompany && (
                        <div className="flex items-center gap-3 min-w-0 lg:w-72 shrink-0">
                            {activeCompany.logo ? (
                                <img
                                    src={resolveMediaUrl(activeCompany.logo)}
                                    alt={activeCompany.businessName}
                                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                            ) : (
                                <span className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                    <Store className="h-5 w-5 text-blue-600" />
                                </span>
                            )}
                            <div className="min-w-0">
                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                                    Active catalog
                                </p>
                                <p className="text-sm font-bold text-slate-800 truncate">
                                    {activeCompany.businessName}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search products by name or category…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-10 border-slate-200 focus-visible:ring-blue-500"
                        />
                    </div>

                    {/*
                        A "Filter" button used to sit here with no `onClick`. A
                        control that does nothing when pressed is worse than no
                        control; mobile's Products screen offers no filter either.
                    */}
                    <div className="flex gap-1 border border-slate-200 rounded-lg p-1 shrink-0 self-start">
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            aria-label="Grid view"
                            className={`p-2 rounded transition-colors ${viewMode === "grid"
                                ? "bg-blue-50 text-blue-600"
                                : "text-slate-500 hover:bg-slate-100"}`}
                        >
                            <Grid3x3 className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            aria-label="List view"
                            className={`p-2 rounded transition-colors ${viewMode === "list"
                                ? "bg-blue-50 text-blue-600"
                                : "text-slate-500 hover:bg-slate-100"}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </Card>

                {loading ? (
                    <Loading label="Loading products…" />
                ) : filteredProducts.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon={Package}
                            title={searchQuery ? 'No products match your search' : 'No products yet'}
                            hint={
                                searchQuery
                                    ? 'Try a different name or category.'
                                    : 'Add products to start showcasing your business and reach more customers.'
                            }
                            action={
                                !searchQuery ? (
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => navigate("/business/add-product")}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Product
                                    </Button>
                                ) : undefined
                            }
                        />
                    </Card>
                ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                        {filteredProducts.map((product) => (
                            <div
                                key={product._id}
                                className="group bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors overflow-hidden flex flex-col"
                            >
                                <div className="h-44 relative overflow-hidden bg-slate-100 shrink-0">
                                    {/*
                                        `imageUrl`, not `productImage`. The Product schema
                                        (backend/src/models/Product.js) has no such field, so
                                        every catalog image rendered as the empty-state icon
                                        however many photos had been uploaded. The stored value
                                        is a relative `/uploads/...` path, which resolves
                                        against THIS site unless it is re-anchored to the API
                                        origin — hence resolveMediaUrl, as on mobile.
                                    */}
                                    {product.imageUrl ? (
                                        <img
                                            src={resolveMediaUrl(product.imageUrl)}
                                            alt={product.name || 'Product'}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="h-14 w-14 text-slate-300" strokeWidth={1.5} />
                                        </div>
                                    )}
                                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/95 shadow-sm text-xs font-semibold text-blue-600">
                                        ₹{Number(product.price || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>

                                <div className="p-5 flex flex-col flex-1">
                                    <h3 className="font-bold text-base text-slate-900 line-clamp-1 mb-1.5">
                                        {product.name}
                                    </h3>
                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">
                                        {product.description || 'No description'}
                                    </p>

                                    <dl className="space-y-1.5 text-sm mb-4">
                                        <div className="flex items-center justify-between">
                                            <dt className="text-slate-500">Category</dt>
                                            <dd className="font-medium text-slate-700 text-xs truncate ml-2">
                                                {product.category}
                                            </dd>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <dt className="text-slate-500">Stock</dt>
                                            {/*
                                                `stock`, not `stockQuantity` — the schema field.
                                                Reading the missing name rendered "undefined
                                                units" and, since every comparison against
                                                undefined is false, painted every product red as
                                                though the whole catalog were out of stock.
                                            */}
                                            <dd className={`font-medium text-xs ${stockTone(Number(product.stock || 0))}`}>
                                                {Number(product.stock || 0)} units
                                            </dd>
                                        </div>
                                        {product.sku && (
                                            <div className="flex items-center justify-between">
                                                <dt className="text-slate-500">SKU</dt>
                                                <dd className="font-medium text-slate-700 text-xs truncate ml-2">
                                                    {product.sku}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                                            onClick={() => navigate(`/business/edit-product/${product._id}`)}
                                        >
                                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(product._id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /*
                        List view as a real table.

                        This was a `space-y-4` stack of full-width cards — a table's
                        worth of data (name, category, price, stock, SKU) rendered as
                        rows ~1100px wide holding ~120px of content, so the middle of
                        every row was empty. Every action was also keyed off
                        `product.id`, which Mongo documents do not have, so Edit
                        navigated to `/business/edit-product/undefined` and Delete
                        sent `DELETE /products/undefined`.
                    */
                    <Card padded={false} className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-[4.375rem]">Image</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="hidden md:table-cell">Category</TableHead>
                                        <TableHead className="hidden lg:table-cell">SKU</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                        <TableHead className="text-right">Stock</TableHead>
                                        <TableHead className="text-right w-[10rem]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.map((product) => (
                                        <TableRow key={product._id}>
                                            <TableCell>
                                                <span className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                                                    {product.imageUrl ? (
                                                        <img
                                                            src={resolveMediaUrl(product.imageUrl)}
                                                            alt={product.name || 'Product'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="h-5 w-5 text-slate-400" />
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <p className="font-semibold text-slate-900 truncate">{product.name}</p>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {product.description || 'No description'}
                                                </p>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-slate-600">
                                                {product.category}
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell text-slate-500 text-xs">
                                                {product.sku || '—'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-blue-600 tabular-nums">
                                                ₹{Number(product.price || 0).toLocaleString('en-IN')}
                                            </TableCell>
                                            <TableCell className={`text-right tabular-nums font-medium ${stockTone(Number(product.stock || 0))}`}>
                                                {Number(product.stock || 0)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                                                        onClick={() => navigate(`/business/edit-product/${product._id}`)}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        <span className="sr-only">Edit</span>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-red-200 text-red-600 hover:bg-red-50"
                                                        onClick={() => handleDelete(product._id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        <span className="sr-only">Delete</span>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}
            </div>
        </BusinessPageShell>
    );
};

export default Products;
