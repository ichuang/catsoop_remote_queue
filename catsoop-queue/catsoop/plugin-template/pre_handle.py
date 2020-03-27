# Collect question info in order to create the "Ask for Help/Checkoff" buttons

if queue_enable:
    queue_questions = {}
    try:
        for problem in cs_problem_spec:
            if type(problem) != tuple:
                continue

            qtype, context = problem
            log = csm_cslog.most_recent(
                cs_course,
                cs_user_info.get('username', 'None'),
                '.'.join(cs_path_info[1:] + ['problemstate']),
                {},
            )
            score = log.get('scores', {}).get(context['csq_name'], 0)
            if score != 1:
                queue_questions[context['csq_name']] = (qtype, context)
    except NameError:
        pass
