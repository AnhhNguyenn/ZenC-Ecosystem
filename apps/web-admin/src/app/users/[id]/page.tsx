import { UserDetail360 } from "@/features/users/UserDetail";

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      <UserDetail360 userId={params.id} />
    </div>
  );
}