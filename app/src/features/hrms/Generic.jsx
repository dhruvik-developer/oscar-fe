import { useAppStore } from "../../stores/appStore";
import PageHeader from "../../components/ui/PageHeader";

export function Generic({ title, subtitle, children }) {
  const showToast = useAppStore((s) => s.showToast);
  return <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button onClick={() => showToast(title + " action")} className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium">Add New</button>
        }
      />
      {children}
    </div>;
}
