# Enable the queue only for users that have a role
try:
    queue_enable = cs_user_info.get('role', None) is not None
except NameError:
    queue_enable = False

# Disable the main queue view on pages by default
queue_page = False

# The default value for the queue_room is None to force errors if unset.  For a single-room setup,
# you can change this to be the name of your room.
queue_room = ${queue_room}
