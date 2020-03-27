# Add the "Ask for Help/Checkoff" for any discovered questions

from bs4 import BeautifulSoup
soup = BeautifulSoup(cs_content)

addtoqueue = '''\
queue.add('{type}', {{
  location: queue.get('location'),
  assignment: {{
    name: '{csq_name}',
    page: catsoop.this_path,
    path: catsoop.path_info,
    display_name: '{csq_display_name}',
  }},
}})
'''

tablenumber_modal = '''\
!queue.get('location') ?
catsoop.modal(
    "Enter Table Number",
    "Please enter your table number:",
    true,
    true).then(function(text) {{
        if(typeof text.value !== 'undefined'){{
            queue.set('location', text.value);
            ''' + addtoqueue + '''
            queue.set('_visible', true);
        }}
    }}) : (''' + addtoqueue + ''', queue.set('_visible', true))'''

def queue_buttons(qtype, context):

    buttons = soup.new_tag('span')
    buttons['id'] = '{}_queue_buttons'.format(context['csq_name'])

    button = soup.new_tag('button')
    button['class'] = ['btn', 'btn-catsoop']
    button.string = 'Ask for Help'
    button['onclick'] = tablenumber_modal.format(
        type = 'help',
        **context,
    )
    buttons.append(' ')
    buttons.append(button)

    if qtype['qtype'] == 'checkoff':
        button = soup.new_tag('button')
        button['class'] = ['btn', 'btn-catsoop']
        button.string = 'Ask for Checkoff'
        button['onclick'] = tablenumber_modal.format(
            type = 'checkoff',
            **context,
        )
        buttons.append(' ')
        buttons.append(button)

    return buttons

if queue_enable:
    for name, (qtype, context) in queue_questions.items():
        qdiv = soup.find(id='cs_qdiv_{}'.format(name))
        if qdiv is None: continue

        buttons = qdiv.find(id='{}_buttons'.format(name))
        if buttons is None: continue

        buttons.insert_after(queue_buttons(qtype, context))

    cs_content = str(soup)
