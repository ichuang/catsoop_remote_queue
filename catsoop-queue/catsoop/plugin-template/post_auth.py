# Determine whether the current user has a staff role or a combined student+staff role
try:
    queue_is_staff = cs_user_info.get('role', None) in ['Admin', 'TA', 'UTA', 'LA']
    queue_is_student_staff = cs_user_info.get('role', None) in ['SLA']
except NameError:
    queue_is_staff = False
    queue_is_student_staff = False
