// Only generic DOM semantics are enabled. No recruiting platform is claimed tested.
export interface Adapter {
  id: string;
  matches: (url: URL) => boolean;
  groupSelector: string;
  labelSelector: string;
}
const generic: Adapter = {
  id: "generic-v1",
  matches: () => true,
  groupSelector:
    'fieldset, [role="group"], [data-experience], .experience-item, .education-item, .project-item',
  labelSelector: "label, .form-label, .field-label",
};
export function adapterFor(url: URL): Adapter {
  return [generic].find((a) => a.matches(url))!;
}
