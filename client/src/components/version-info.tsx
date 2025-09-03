import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface VersionData {
  version: string;
  fullVersion: string;
  build: string;
  name: string;
}

export function VersionInfo() {
  const { data: versionData } = useQuery<VersionData>({
    queryKey: ["/api/version"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (!versionData) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center space-y-1">
            <Badge variant="outline" className="text-xs">
              GrapholexInsight {versionData.version}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {versionData.name}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <div className="text-sm">
            <div className="font-semibold">{versionData.fullVersion}</div>
            <div className="text-muted-foreground">Build: {versionData.build}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}