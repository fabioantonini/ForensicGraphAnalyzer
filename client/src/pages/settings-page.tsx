import { ApiSettings } from "@/components/settings/api-settings-new";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SecuritySettings } from "@/components/settings/security-settings";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold text-primary mb-6">Account Settings</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Profile Settings */}
        <div className="md:col-span-2">
          <ProfileSettings />
        </div>
        
        {/* API Settings */}
        <div>
          <ApiSettings />
        </div>
      </div>
      
      {/* Security Settings */}
      <SecuritySettings />
    </div>
  );
}
