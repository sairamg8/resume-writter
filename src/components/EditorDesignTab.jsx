import DesignPanel from '@/components/DesignPanel';

/**
 * The Design tab: the résumé's look, which applies to the whole résumé. `group` / `onGroupChange` are
 * the open one of its views (kept by the Editor across tabs); the rest goes to DesignPanel.
 */
export function EditorDesignTab({ group, onGroupChange, ...panel }) {
  return (
    <div className="px-4 py-4">
      <DesignPanel {...panel} />
    </div>
  );
}
