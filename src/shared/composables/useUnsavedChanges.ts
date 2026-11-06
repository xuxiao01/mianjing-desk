import { onBeforeUnmount, onMounted } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { forcedExit } from '@/modules/auth/session';
import { useDialog } from 'naive-ui';

export function useUnsavedChanges(
  isDirty: () => boolean,
  options: {
    isPending?: () => boolean;
    onRouteLeave?: () => void;
    routeDirty?: () => boolean;
  } = {},
) {
  const dialog = useDialog();
  let confirmation: Promise<boolean> | undefined;
  function allowLeave(warn = isDirty()): Promise<boolean> {
    if (!warn) return Promise.resolve(true);
    if (confirmation) return confirmation;
    confirmation = new Promise((resolve) => {
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
    const current = confirmation;
    void current.then(() => {
      if (confirmation === current) confirmation = undefined;
    });
    return current;
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (options.routeDirty?.() ?? isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload));
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload));
  async function guard() {
    if (forcedExit.value) return true;
    if (options.isPending?.()) return false;
    if (!(await allowLeave(options.routeDirty?.() ?? isDirty()))) return false;
    options.onRouteLeave?.();
    return true;
  }
  onBeforeRouteLeave(guard);
  onBeforeRouteUpdate(guard);
  return { allowLeave };
}
