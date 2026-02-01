import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GroupIconSelector } from "@/features/group/GroupIconSelector";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; icon: string; isDefault: boolean }) => void;
}

export function CreateGroupModal({ isOpen, onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏠");
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = () => {
    if (name.trim()) {
      onCreate({ name, icon, isDefault });
      setName("");
      setIcon("🏠");
      setIsDefault(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>创建新群组</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 群组名称 */}
          <div>
            <Label>群组名称 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：温馨小家"
              className="mt-1"
            />
          </div>

          {/* 群组图标 */}
          <div>
            <Label>选择群组图标</Label>
            <GroupIconSelector selectedIcon={icon} onSelect={setIcon} />
          </div>

          {/* 设为默认群组 */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="isDefault" className="cursor-pointer font-normal">
              设为默认群组
            </Label>
          </div>

          {/* 提示信息 */}
          <div className="bg-orange-50 rounded-lg p-3 text-sm text-gray-600">
            <p>💡 创建后将自动生成邀请码，你可以分享给家人加入群组</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="bg-orange-500 hover:bg-orange-600"
          >
            创建群组
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
