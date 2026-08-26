import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Mail, Phone, User, VenetianMask, MapPin, Calendar, Briefcase, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define TypeScript interfaces
interface MemberDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  gender: string;
  sector: string;
  phone: string;
  block?: string;
  district?: string;
  state?: string;
  memberType?: string;
  registrationDate?: string;
  profilePictureUrl?: string;
}

interface ApprovalCardProps {
  member: MemberDetails;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  status?: 'pending' | 'approved' | 'rejected';
}

const ApprovalCard = ({ member, onApprove, onReject, status = 'pending' }: ApprovalCardProps) => {
  const { toast } = useToast();

  const handleApprove = () => {
    onApprove(member.id);
    toast({
      title: "Member Approved",
      description: `${member.name} has been approved successfully.`,
    });
  };

  const handleReject = () => {
    onReject(member.id);
    toast({
      title: "Member Rejected",
      description: `${member.name} has been rejected.`,
      variant: "destructive",
    });
  };

  return (
    <Card className="shadow-medium border-0 hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar className="w-16 h-16">
          {member.profilePictureUrl && (
            <AvatarImage src={member.profilePictureUrl} alt={member.name || 'User'} />
          )}
          <AvatarFallback className="bg-primary text-primary-foreground text-xl">
            {(member.name || 'User').split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">{member.name || 'Unknown User'}</h3>
            {member.memberType && (
              <Badge variant="outline" className="capitalize">
                {member.memberType}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground mt-1">
            <Mail className="w-4 h-4" />
            <span className="text-sm">{member.email}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {member.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Phone:</span>
            <span>{member.phone}</span>
          </div>
        )}
        
        {(member.block || member.district || member.state) && (
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Location:</span>
            <span className="text-sm">
              {[member.block, member.district, member.state].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        
        {member.registrationDate && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Registered:</span>
            <span className="text-sm">
              {new Date(member.registrationDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        )}
        
        {member.role && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Role:</span>
            <Badge variant="secondary">{member.role}</Badge>
          </div>
        )}
        
        {member.sector && (
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Sector:</span>
            <Badge variant="outline">{member.sector}</Badge>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        {status === 'approved' && (
          <Button 
            variant="default" 
            disabled
            className="flex items-center gap-2 bg-green-600 hover:bg-green-600 w-full"
          >
            <CheckCircle className="w-4 h-4" />
            Approved
          </Button>
        )}
        {status === 'rejected' && (
          <Button 
            variant="destructive" 
            disabled
            className="flex items-center gap-2 bg-red-600 hover:bg-red-600 w-full"
          >
            <XCircle className="w-4 h-4" />
            Rejected
          </Button>
        )}
        {status === 'pending' && (
          <>
            <Button 
              variant="outline"
              className="flex items-center gap-2 bg-yellow-100 border-yellow-400 text-yellow-700 hover:bg-yellow-200 hover:text-yellow-800"
              disabled
            >
              <Clock className="w-4 h-4" />
              Pending
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleReject}
                className="flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button 
                variant="default" 
                onClick={handleApprove}
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default ApprovalCard;