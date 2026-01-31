import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/AppContext";
import { InviteCodeDisplay } from "@/features/group/InviteCodeDisplay";
import { GroupMemberList } from "@/features/group/GroupMemberList";

export function GroupView() {
  const { groups, createGroupModal } = useApp();
  return (
    <section className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">家庭群组管理 👥</h2>
          <p className="text-gray-500 text-sm mt-1">管理你的家庭群组和成员</p>
        </div>
        <Button onClick={onCreateGroup} className="bg-orange-500 hover:bg-orange-600">
          <span className="mr-2">➕</span>
          创建群组
        </Button>
      </div>

      {/* 群组列表 */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-400 mb-4">还没有群组</p>
            <Button onClick={createGroupModal.open} className="bg-orange-500 hover:bg-orange-600">
              创建第一个群组
            </Button>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                    {group.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-gray-800">{group.name}</h3>
                      {group.isDefault && (
                        <Badge className="bg-yellow-100 text-yellow-700">⭐ 默认群组</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{group.memberCount} 位成员</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!group.isDefault && (
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                      退出群组
                    </Button>
                  )}
                  {group.isDefault && (
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                      解散群组
                    </Button>
                  )}
                </div>
              </div>

              {/* 邀请码 */}
              <InviteCodeDisplay inviteCode={group.inviteCode || ""} />

              {/* 成员列表 */}
              <GroupMemberList groupId={group.id} />
            </Card>
          ))
        )}
      </div>

      {/* 加入群组入口 */}
      <Card className="p-6 mt-6 bg-linear-to-br from-orange-50 to-orange-100 border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 mb-1">加入现有群组</h3>
            <p className="text-sm text-gray-600">输入邀请码快速加入家人的群组</p>
          </div>
          <Button variant="outline" className="bg-white">
            输入邀请码
          </Button>
        </div>
      </Card>
    </section>
  );
}
