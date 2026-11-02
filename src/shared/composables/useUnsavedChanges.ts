import { onBeforeUnmount, onMounted } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { forcedExit } from '@/modules/auth/session';
import { useDialog } from 'naive-ui';

export function useUnsavedChanges(
  isDirty: () => boolean,
  options: { isPending?: () => boolean; onRouteLeave?: () => void } = {},
) {
  const dialog = useDialog();
  function allowLeave(): Promise<boolean> {
    if (!isDirty()) return Promise.resolve(true);
    return new Promise((resolve) => {
      dialog.warning({
        title: '还有未保存的内容',
        content: '离开会丢失这次修改，要放弃修改吗？',
        positiveText: '放弃修改',
        negativeText: '继续编辑',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false),
        onMaskClick: () => resolve(false),
        onEsc: () => resolve(false),
      });
    });
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload));
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
  async function guard() {
    if (forcedExit.value) return true;
    if (options.isPending?.()) return false;
    if (!(await allowLeave())) return false;
    options.onRouteLeave?.();
    return true;
  }
  onBeforeRouteLeave(guard);
  onBeforeRouteUpdate(guard);
  return { allowLeave };
}
