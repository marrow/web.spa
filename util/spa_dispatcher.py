# encoding: utf-8


class SPADispatcher():
    def __call__(self, context, obj, path):
        if context.request.is_xhr or 'Authentication' in context.request.headers:
            yield None, obj.api, False
        else:
            yield None, obj.spa, False
