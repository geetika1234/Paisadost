import { MIN_VISIT_PHOTOS } from '../../logic/stages'

/**
 * Maps errors raised by our SQL functions/triggers (supabase/migrations) to
 * messages agents can act on. Unknown errors keep their original message so
 * nothing is hidden while debugging.
 */
const MESSAGES = {
  not_approved:                    'Aapka account abhi approve nahi hua. Admin se baat karein.',
  delete_not_allowed:              'Yeh lead aap delete nahi kar sakte. Sirf apni aaj ki nayi lead delete ho sakti hai.',
  customer_not_found:              'Yeh lead nahi mili. Shayad pehle hi delete ho chuki hai.',
  profile_privilege_change_denied: 'Role ya approval sirf admin badal sakta hai.',
  admin_self_demotion_blocked:     'Aap apna admin role khud nahi hata sakte.',
  profile_id_immutable:            'Profile ID badli nahi ja sakti.',
  stage_role_denied:               'Yeh step aap nahi kar sakte. Manager se baat karein.',
  stage_evidence_missing:          `Visit save karne ke liye ${MIN_VISIT_PHOTOS} photo zaroori hain.`,
  status_change_denied:            'Is lead ka status aap nahi badal sakte. Admin se baat karein.',
  status_reason_required:          'Reason chunna zaroori hai.',
  status_reason_too_long:          'Note chhota rakhein (300 characters tak).',
  status_rejected_needs_login:     'Rejected sirf Login Done ke baad ho sakta hai.',
  status_invalid:                  'Yeh status maanya nahi hai.',
  mobile_is_team_member:           'Yeh number hamari team ke ek member ka hai. Customer ka apna number daalein.',
  admin_only:                      'Yeh sirf admin ya manager kar sakte hain.',
  bulk_limit:                      'Ek baar mein 100 leads tak hi chun sakte hain.',
}

export function friendlyDbError(err, fallback = 'Kuch galat ho gaya. Dobara try karein.') {
  const raw = err?.message || ''
  const key = Object.keys(MESSAGES).find(k => raw.includes(k))
  if (key) return MESSAGES[key]
  return raw || fallback
}
