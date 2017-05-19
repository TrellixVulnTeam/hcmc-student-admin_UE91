var express = require('express')
var path = require('path')
var formidable = require('formidable')
var session = require('express-session')
var fs = require('fs')
var router = express.Router()

var User = require('./../models/user')
var Login = require('./../models/login')
var Activity = require('./../models/activity')
var Topic = require('./../models/topic')

var sess;

function convertToASCII(str) {
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/ /g, "-");
    return str;
}

router.get('/activity', function (req, res) {
    sess = req.session
    if (sess.email) {
        Activity.find({}, function (err, data) {
            if (err) {
                return res.render('pages_activity/index.ejs')
            }
    
            if (data) {
                return res.render('pages_activity/activity.ejs', {
                    activity: data,
                    req: req
                })
            }
        })
    } else {
        return res.redirect('/')
    }
})

router.get('/activity/:topic_ascii', function (req, res) {
    let news = []
    Activity.findOne({topic_ascii: req.params.topic_ascii})
        .sort({updated_at: -1})
        .then(data => {
            var i = data.news.length - 1
            for (i; i >= 0; i--){
                news.push(data.news[i])
            }
            return res.render('pages_activity/topic.ejs', {
                data: data,
                news: news
            })
        })
        .catch(err => {
            return res.render('pages_activity/index.ejs')
        })
})

router.post('/activity/topic/add', function (req, res) {
    let topic = req.body.topic
    let topic_ascii = convertToASCII(topic)
    var data = Activity({
        topic: topic,
        topic_ascii: topic_ascii,
        is_enable: true,
        news: []
    })

    Activity.findOne({topic: req.body.topic}, function (err, topic) {
        if (err) throw err
        if (!topic) {
            data.save(function (err) {
                if (err) throw err
                Activity.findOne({topic: req.body.topic}, function (err, info) {
                    if (err) throw err
                    if (info) {
                        info_topic = Topic({
                            id_topic: info._id,
                            name_source: 'Hoạt động',
                            name_topic: info.topic
                        })
                        info_topic.save()
                        return res.redirect('/activity')
                    }
                })
            })
        } else {
            return res.redirect('/')
        }
    })
})

router.post('/activity/add/news', function (req, res) {
    var form = new formidable.IncomingForm()

    form.multiples = true
    form.keepExtensions = true
    form.uploadDir = path.join(__dirname, './../uploads/activity')
    form.parse(req, function (err, fields, files) {
        if (err) {
            console.log('Error is: ' + err)
        }
        var imageDir = files.thumbnail.path
        var topic_ascii = fields.topic_ascii
        var id = fields._id
        var data = {
            "title": fields.title,
            "thumbnail": imageDir.substring(imageDir.indexOf('/uploads/activity/')),
            "brief": fields.brief,
            "is_accept": sess.is_accept,
            "content": fields.content,
        }
        Activity.findOne({topic_ascii: topic_ascii}, function (err, news) {
            if (err) console.log(err)
            if (news) {
                news.news.push(data)
                news.save()
                news.news.sort({updated_at: -1})
                return res.redirect('./../../activity/' + topic_ascii)
            } else {
                return res.render('pages_activity/index.ejs')
            }
        })
    })
})

router.get('/activity/:topic_ascii/:id', function (req, res) {
    Activity.findOne({topic_ascii: req.params.topic_ascii}, function (err, news) {
        if (err) return console.log(err)
        if (news) {
            for (var i = 0; i < news.news.length; i++) {
                if (news.news[i].id === req.params.id) {
                    return res.render('pages_activity/news_detail.ejs', {
                        topic: news,
                        news: news.news[i]
                    })
                }
            }
        }
    })
})

router.post('/activity/update/:topic_ascii/:id', function (req, res) {
    var form = new formidable.IncomingForm()
    let thumbnail = ''
    let dirImage = ''

    form.multiples = true
    form.keepExtensions = true
    form.uploadDir = path.join(__dirname, './../uploads/activity')
    form.parse(req, function (err, fields, files) {
        if (err) {
            console.log('Error is: ' + err)
        }
        var topic_ascii = req.params.topic_ascii
        var id = req.params.id
        Activity.findOne({topic_ascii: topic_ascii}, function (err, news) {
            if (err) console.log(err)
            if (news) {
                for (var i = 0; i < news.news.length; i++) {
                    if (news.news[i].id === req.params.id) {
                        dirImage = path.join(__dirname, './../' + news.news[i].thumbnail)
                        if (files.thumbnail.size != 0) {
                            thumbnail = files.thumbnail.path
                            fs.unlinkSync(dirImage)
                        } else {
                            thumbnail = dirImage
                        }
                        if (fields.is_accept == 'on') {
                            fields.is_accept = true
                        } else {
                            fields.is_accept = false
                        }
                         var data = {
                            "title": fields.title,
                            "thumbnail": thumbnail.substring(thumbnail.indexOf('/uploads/')),
                            "brief": fields.brief,
                            "is_accept": fields.is_accept,
                            "content": fields.content,
                        }
                        news.news[i].title = data.title
                        news.news[i].thumbnail = data.thumbnail
                        news.news[i].brief = data.brief
                        news.news[i].is_accept = data.is_accept
                        news.news[i].content = data.content
                        news.save()
                        return res.redirect('./../../../activity/' + topic_ascii)
                    }
                }
            } else {
                if (files.thumbnail) {
                    fs.unlink(files.thumbnail.path)
                }
                return res.render('pages_activity/index.ejs')
            }
        })
    })
})
module.exports = router