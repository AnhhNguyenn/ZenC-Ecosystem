import { FeatureFlags } from "@/features/system/FeatureFlags";

export default function FlagsPage() {
  return (
    <div className="container mx-auto py-8">
      <FeatureFlags />
    </div>
  );
}