import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy } from "lucide-react";

interface InviteCodeDisplayProps {
  inviteCode: string;
}

export function InviteCodeDisplay({ inviteCode }: InviteCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-orange-50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-2">邀请码（分享给家人加入）</p>
          <div className="flex items-center gap-2">
            <Input
              value={inviteCode}
              readOnly
              className="bg-white font-mono text-lg font-bold tracking-wider"
            />
            <Button onClick={handleCopy} size="sm" variant="outline" className="bg-white">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  复制
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
