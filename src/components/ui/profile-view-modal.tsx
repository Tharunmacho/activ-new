import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Building, Calendar, User, FileText, DollarSign, CheckCircle } from "lucide-react";

interface ProfileData {
  name?: string;
  email?: string;
  phone?: string;
  block?: string;
  district?: string;
  state?: string;
  city?: string;
  religion?: string;
  socialCategory?: string;
  doingBusiness?: string;
  organization?: string;
  constitution?: string;
  businessTypes?: string[];
  businessYear?: string;
  employees?: string;
  chamber?: string;
  govtOrgs?: string[];
  pan?: string;
  gst?: string;
  udyam?: string;
  filedITR?: string;
  itrYears?: string;
  turnoverRange?: string;
  turnover1?: string;
  turnover2?: string;
  turnover3?: string;
  govtSchemes?: string;
  sisterConcerns?: string;
  companyNames?: string;
  declarationAccepted?: boolean;
  isLocked?: boolean;
  completedSteps?: number[];
}

interface ProfileViewModalProps {
  open: boolean;
  onClose: () => void;
  profile: ProfileData | null;
  loading?: boolean;
}

const ProfileViewModal = ({ open, onClose, profile, loading }: ProfileViewModalProps) => {
  if (!profile && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Application Details</DialogTitle>
          <DialogDescription>
            Complete application information submitted by the member
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : !profile || Object.keys(profile).filter(key => key !== '_id' && key !== 'userId' && key !== '__v' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'isLocked' && key !== 'completedSteps' && profile[key]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <User className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Profile Data</h3>
            <p className="text-sm text-muted-foreground">This user has not filled in their profile information yet.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
            <div className="space-y-6">
              {/* Personal Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile?.name && (
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Name</p>
                        <p className="font-medium">{profile.name}</p>
                      </div>
                    </div>
                  )}
                  {profile?.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="font-medium">{profile.email}</p>
                      </div>
                    </div>
                  )}
                  {profile?.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Phone</p>
                        <p className="font-medium">{profile.phone}</p>
                      </div>
                    </div>
                  )}
                  {(profile?.block || profile?.district || profile?.state) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Location</p>
                        <p className="font-medium">
                          {[profile?.block, profile?.district, profile?.state].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {profile?.city && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">City</p>
                        <p className="font-medium">{profile.city}</p>
                      </div>
                    </div>
                  )}
                  {profile?.religion && (
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Religion</p>
                        <p className="font-medium">{profile.religion}</p>
                      </div>
                    </div>
                  )}
                  {profile?.socialCategory && (
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Social Category</p>
                        <p className="font-medium">{profile.socialCategory}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Information */}
              {(profile?.doingBusiness || profile?.organization) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Building className="w-5 h-5 text-primary" />
                      Business Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile?.doingBusiness && (
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Doing Business</p>
                            <p className="font-medium">{profile.doingBusiness}</p>
                          </div>
                        </div>
                      )}
                      {profile?.organization && (
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Organization</p>
                            <p className="font-medium">{profile.organization}</p>
                          </div>
                        </div>
                      )}
                      {profile?.constitution && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Constitution</p>
                            <p className="font-medium">{profile.constitution}</p>
                          </div>
                        </div>
                      )}
                      {profile?.businessTypes && profile.businessTypes.length > 0 && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Business Types</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {profile.businessTypes.map((type, idx) => (
                                <Badge key={idx} variant="outline">{type}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {profile?.businessYear && (
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Business Year</p>
                            <p className="font-medium">{profile.businessYear}</p>
                          </div>
                        </div>
                      )}
                      {profile?.employees && (
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Employees</p>
                            <p className="font-medium">{profile.employees}</p>
                          </div>
                        </div>
                      )}
                      {profile?.chamber && (
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Chamber</p>
                            <p className="font-medium">{profile.chamber}</p>
                          </div>
                        </div>
                      )}
                      {profile?.govtOrgs && profile.govtOrgs.length > 0 && (
                        <div className="flex items-start gap-2 md:col-span-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Government Organizations</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {profile.govtOrgs.map((org, idx) => (
                                <Badge key={idx} variant="secondary">{org}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Financial & Compliance */}
              {(profile?.pan || profile?.gst || profile?.udyam) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      Financial & Compliance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile?.pan && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">PAN</p>
                            <p className="font-medium">{profile.pan}</p>
                          </div>
                        </div>
                      )}
                      {profile?.gst && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">GST</p>
                            <p className="font-medium">{profile.gst}</p>
                          </div>
                        </div>
                      )}
                      {profile?.udyam && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Udyam</p>
                            <p className="font-medium">{profile.udyam}</p>
                          </div>
                        </div>
                      )}
                      {profile?.filedITR && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Filed ITR</p>
                            <p className="font-medium">{profile.filedITR}</p>
                          </div>
                        </div>
                      )}
                      {profile?.itrYears && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">ITR Years</p>
                            <p className="font-medium">{profile.itrYears}</p>
                          </div>
                        </div>
                      )}
                      {profile?.turnoverRange && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Turnover Range</p>
                            <p className="font-medium">{profile.turnoverRange}</p>
                          </div>
                        </div>
                      )}
                      {profile?.turnover1 && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Turnover Year 1</p>
                            <p className="font-medium">{profile.turnover1}</p>
                          </div>
                        </div>
                      )}
                      {profile?.turnover2 && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Turnover Year 2</p>
                            <p className="font-medium">{profile.turnover2}</p>
                          </div>
                        </div>
                      )}
                      {profile?.turnover3 && (
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Turnover Year 3</p>
                            <p className="font-medium">{profile.turnover3}</p>
                          </div>
                        </div>
                      )}
                      {profile?.govtSchemes && (
                        <div className="flex items-start gap-2 md:col-span-2">
                          <FileText className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Government Schemes</p>
                            <p className="font-medium">{profile.govtSchemes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Declaration */}
              {(profile?.sisterConcerns || profile?.companyNames || profile?.declarationAccepted) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      Declaration
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {profile?.sisterConcerns && (
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Sister Concerns</p>
                            <p className="font-medium">{profile.sisterConcerns}</p>
                          </div>
                        </div>
                      )}
                      {profile?.companyNames && (
                        <div className="flex items-start gap-2">
                          <Building className="w-4 h-4 text-muted-foreground mt-1" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Company Names</p>
                            <p className="font-medium">{profile.companyNames}</p>
                          </div>
                        </div>
                      )}
                      {profile?.declarationAccepted && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <p className="font-medium text-green-600">Declaration Accepted</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Profile Status */}
              {(profile?.isLocked !== undefined || (profile?.completedSteps && profile.completedSteps.length > 0)) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Profile Status</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile?.isLocked && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          Profile Locked
                        </Badge>
                      )}
                      {profile?.completedSteps && profile.completedSteps.length > 0 && (
                        <Badge variant="outline">
                          Completed Steps: {profile.completedSteps.join(', ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileViewModal;
