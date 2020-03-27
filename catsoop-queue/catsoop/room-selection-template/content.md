<python>
cs_title = "Queue"
cs_long_name = "Queue"
rooms = ${rooms}

link_template = "* [{room}]({room})"
</python>

Select room:

<python>
for room in rooms:
    cs_print(link_template.format(room=room))
</python>
